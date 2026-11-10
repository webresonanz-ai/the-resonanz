<script setup>
import { computed, onUnmounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { checkInByTicketId } from '@/firebase/checkin'

/* ---- auth ---- */
const authStore = useAuthStore()

/* ---- scanner state ---- */
const scannerReady = ref(false)
const scanning = ref(false)
const scanError = ref('')
const checkingIn = ref(false)

/* ---- last scan result ---- */
const lastResult = ref(null)   // { status, registration } | null
const lastRawValue = ref('')   // raw string read from the QR

/* ---- camera controls ---- */
const cameras = ref([])        // { id, label }[]
const selectedCameraId = ref('')
const hasFlash = ref(false)
const flashOn = ref(false)
const scannerInstance = ref(null)
const videoRef = ref(null)
const overlayRef = ref(null)

/* ---- cooldown guard: prevent firing twice on the same QR ---- */
let lastScannedTicket = ''
let cooldownTimer = null

function resetCooldown() {
  lastScannedTicket = ''
  if (cooldownTimer) clearTimeout(cooldownTimer)
  cooldownTimer = null
}

/* ---- result formatting ---- */
const statusLabel = computed(() => {
  if (!lastResult.value) return ''
  if (lastResult.value.status === 'checked_in') return 'Checked in!'
  if (lastResult.value.status === 'already_checked_in') return 'Already checked in'
  return 'Not found'
})

const statusClass = computed(() => {
  if (!lastResult.value) return ''
  if (lastResult.value.status === 'checked_in')
    return 'border-emerald-700/50 bg-emerald-950/30 text-emerald-100'
  if (lastResult.value.status === 'already_checked_in')
    return 'border-amber-700/50 bg-amber-950/30 text-amber-100'
  return 'border-rose-700/50 bg-rose-950/30 text-rose-200'
})

const badgeClass = computed(() => {
  if (!lastResult.value) return ''
  if (lastResult.value.status === 'checked_in')
    return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
  if (lastResult.value.status === 'already_checked_in')
    return 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
  return 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
})

const badgeIcon = computed(() => {
  if (!lastResult.value) return ''
  if (lastResult.value.status === 'checked_in')
    return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
  if (lastResult.value.status === 'already_checked_in')
    return 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
  return 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
})

function formatDateTime(value) {
  if (!value) return ''
  const date = value?.toDate ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/* ---- QrScanner lifecycle ---- */
async function startScanner() {
  scanError.value = ''
  lastResult.value = null
  lastRawValue.value = ''
  checkingIn.value = false

  // Load lazily so the heavy worker is only fetched when this page opens
  const { default: QrScanner } = await import('qr-scanner')

  // Don't gate on QrScanner.hasCamera(): some browsers return an empty device
  // list until camera permission has been granted, which would wrongly report
  // "no camera found" on a perfectly capable device.
  if (!navigator.mediaDevices?.getUserMedia) {
    scanError.value = 'Camera access is not supported in this browser.'
    return
  }

  if (!videoRef.value) {
    scanError.value = 'Camera preview element is not ready. Please try again.'
    return
  }

  // The preview must be visible BEFORE QrScanner starts. qr-scanner runs
  // _onLoadedMetaData on the video and, if it is display:none at that point,
  // force-hides it (opacity 0, width/height 0) to avoid Safari playback
  // issues — which leaves us with a black preview and a removed overlay.
  scanning.value = true

  const qrScanner = new QrScanner(
    videoRef.value,
    (result) => handleScanResult(result.data),
    {
      returnDetailedScanResult: true,
      preferredCamera: selectedCameraId.value || 'environment',
      highlightScanRegion: true,
      highlightCodeOutline: true,
      overlay: overlayRef.value ?? undefined,
      maxScansPerSecond: 10,
    },
  )

  try {
    await qrScanner.start()
    scannerInstance.value = qrScanner
    hasFlash.value = await qrScanner.hasFlash()

    // Labels are only available once the camera permission has been granted.
    const labelledCams = await QrScanner.listCameras(true)
    if (labelledCams.length) cameras.value = labelledCams

    // Capture the camera that was actually started, in case the preference
    // fell back to something else.
    if (selectedCameraId.value === '') {
      const activeTrack = videoRef.value?.srcObject?.getVideoTracks?.()[0]
      selectedCameraId.value =
        activeTrack?.getSettings?.().deviceId || cameras.value[0]?.id || ''
    }
  } catch (err) {
    qrScanner.destroy()
    scanning.value = false
    const msg = err?.message || String(err) || ''
    if (/permission|denied|not allowed/i.test(msg)) {
      scanError.value = 'Camera permission denied. Allow camera access and try again.'
    } else if (/https/i.test(msg)) {
      scanError.value = 'Camera requires a secure (HTTPS) connection.'
    } else {
      scanError.value = msg || 'Unable to start the camera.'
    }
  }
}

function stopScanner() {
  scannerInstance.value?.destroy()
  scannerInstance.value = null
  scanning.value = false
  hasFlash.value = false
  flashOn.value = false
  resetCooldown()
}

async function switchCamera(cameraId) {
  if (!scannerInstance.value) return
  selectedCameraId.value = cameraId
  try {
    await scannerInstance.value.setCamera(cameraId)
  } catch (err) {
    scanError.value = err?.message || 'Unable to switch camera.'
  }
}

async function toggleFlash() {
  if (!scannerInstance.value) return
  try {
    await scannerInstance.value.toggleFlash()
    flashOn.value = scannerInstance.value.isFlashOn()
  } catch (err) {
    scanError.value = err?.message || 'Unable to toggle flash.'
  }
}

/* ---- handle decoded QR ---- */
async function handleScanResult(rawValue) {
  if (checkingIn.value) return
  if (rawValue === lastScannedTicket) return

  // Cooldown: ignore the same QR for 4 s to avoid duplicate writes from
  // the same held-up QR code being scanned multiple times in rapid succession.
  lastScannedTicket = rawValue
  if (cooldownTimer) clearTimeout(cooldownTimer)
  cooldownTimer = setTimeout(resetCooldown, 4000)

  lastRawValue.value = rawValue
  lastResult.value = null
  scanError.value = ''
  checkingIn.value = true

  try {
    const result = await checkInByTicketId(rawValue, {
      uid: authStore.user.uid,
      displayName: authStore.user.displayName,
      email: authStore.user.email,
    })
    lastResult.value = result
  } catch (err) {
    scanError.value = err?.message || 'Unable to check in this guest. Please try again.'
  } finally {
    checkingIn.value = false
  }
}

/* ---- initial load ---- */
scannerReady.value = true

onUnmounted(() => {
  stopScanner()
})
</script>

<template>
  <div class="space-y-5 sm:space-y-8">

    <!-- Page header -->
    <header>
      <p class="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-gold-400/80 mb-1.5 sm:mb-2">Check-in</p>
      <h1 class="text-2xl sm:text-4xl font-serif text-bone-100">Scan <span class="text-gold-gradient">QR Code</span></h1>
      <p class="mt-2 text-[13px] sm:text-base text-bone-500 max-w-2xl">
        Point the camera at a workshop audience's QR ticket to check them in. Each ticket can only be scanned once.
      </p>
    </header>

    <!-- Scanner + controls in a two-column layout on larger screens -->
    <div class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.75fr)]">

      <!-- Left: camera view -->
      <section class="rounded-2xl border border-maroon-700/60 glass-card overflow-hidden">
        <div class="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-4 border-b border-maroon-700/50">
          <h2 class="text-sm sm:text-base font-serif text-bone-100">Camera</h2>

          <div class="flex items-center gap-2">
            <!-- Flash toggle (only visible when scanning + flash available) -->
            <button
              v-if="scanning && hasFlash"
              type="button"
              class="p-2 rounded-lg border transition-colors"
              :class="flashOn
                ? 'border-gold-500/60 bg-gold-500/15 text-gold-300'
                : 'border-maroon-700/60 text-bone-400 hover:text-gold-300'"
              :title="flashOn ? 'Turn flash off' : 'Turn flash on'"
              @click="toggleFlash"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>

            <!-- Start / stop -->
            <button
              v-if="!scanning"
              type="button"
              class="px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-gold-500 text-maroon-950 text-[13px] sm:text-sm font-semibold hover:bg-gold-400 transition-colors disabled:opacity-60"
              :disabled="checkingIn"
              @click="startScanner"
            >
              Start camera
            </button>
            <button
              v-else
              type="button"
              class="px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-maroon-700/60 text-[13px] sm:text-sm text-bone-300 hover:text-rose-300 transition-colors"
              @click="stopScanner"
            >
              Stop
            </button>
          </div>
        </div>

        <!-- Error banner -->
        <div
          v-if="scanError"
          role="alert"
          class="mx-4 sm:mx-5 mt-4 rounded-xl border border-rose-700/50 bg-rose-950/30 p-3 text-sm text-rose-200"
        >
          {{ scanError }}
        </div>

        <!-- Camera select (only when multiple cameras and scanning) -->
        <div v-if="scanning && cameras.length > 1" class="px-4 sm:px-5 pt-4">
          <label class="block text-[11px] sm:text-xs font-medium text-bone-400 mb-1.5">Camera</label>
          <select
            :value="selectedCameraId"
            class="w-full sm:w-auto rounded-lg border border-maroon-700/60 bg-maroon-950/60 px-3 py-2 text-sm text-bone-200 outline-none focus:border-gold-500/60"
            @change="switchCamera($event.target.value)"
          >
            <option v-for="cam in cameras" :key="cam.id" :value="cam.id">
              {{ cam.label || cam.id }}
            </option>
          </select>
        </div>

        <!-- Video element + overlay wrapper -->
        <div
          class="relative bg-maroon-950 rounded-xl overflow-hidden m-4 sm:m-5 aspect-[4/3] min-h-[12rem] sm:min-h-[18rem]"
        >
          <!-- Idle placeholder -->
          <div
            v-if="!scanning"
            class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 py-8 text-center bg-maroon-950"
          >
            <div class="w-16 h-16 rounded-2xl border border-maroon-700/60 bg-maroon-800/40 flex items-center justify-center">
              <svg class="w-8 h-8 text-gold-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m0 0V9m0 3v3m10-7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <p class="text-sm text-bone-400">Press <span class="text-bone-200 font-medium">Start camera</span> to begin scanning</p>
          </div>

          <!-- Kept visible at all times: qr-scanner hides display:none videos -->
          <video
            ref="videoRef"
            class="block w-full h-full object-cover"
            playsinline
            muted
          ></video>

          <!-- qr-scanner overlay div (scan region highlight) -->
          <div ref="overlayRef" class="absolute inset-0 pointer-events-none"></div>

          <!-- Checking-in spinner -->
          <div
            v-if="checkingIn"
            class="absolute inset-0 flex items-center justify-center bg-maroon-950/70 backdrop-blur-sm"
          >
            <div class="flex flex-col items-center gap-3">
              <svg class="w-10 h-10 text-gold-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p class="text-sm text-bone-300">Checking in…</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Right: last scan result -->
      <section class="rounded-2xl border border-maroon-700/60 glass-card p-4 sm:p-5 flex flex-col gap-5">
        <h2 class="text-sm sm:text-base font-serif text-bone-100">Last scan result</h2>

        <!-- Idle -->
        <div v-if="!lastResult && !checkingIn && !lastRawValue" class="flex flex-col items-center justify-center gap-3 py-8 text-center flex-1">
          <div class="w-14 h-14 rounded-2xl border border-maroon-700/60 bg-maroon-800/40 flex items-center justify-center">
            <svg class="w-7 h-7 text-bone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p class="text-sm text-bone-400">No QR code scanned yet.</p>
        </div>

        <!-- Checking-in -->
        <div v-else-if="checkingIn && !lastResult" class="flex flex-col items-center justify-center gap-3 py-8 text-center flex-1">
          <div class="w-14 h-14 rounded-2xl border border-gold-500/30 bg-gold-500/10 flex items-center justify-center">
            <svg class="w-7 h-7 text-gold-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p class="text-sm text-bone-300">Looking up ticket…</p>
          <p class="text-xs font-mono text-bone-500 break-all max-w-full">{{ lastRawValue }}</p>
        </div>

        <!-- Result card -->
        <div v-else-if="lastResult" class="space-y-4">
          <!-- Status banner -->
          <div
            :class="['rounded-xl border p-3 sm:p-4', statusClass]"
          >
            <div class="flex items-center gap-3">
              <span :class="['flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center', badgeClass]">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="badgeIcon" />
                </svg>
              </span>
              <div>
                <p class="text-sm font-semibold">{{ statusLabel }}</p>
                <p v-if="lastResult.status === 'not_found'" class="text-xs opacity-70 mt-0.5">
                  This QR code doesn't match any registered guest.
                </p>
                <p v-else-if="lastResult.status === 'already_checked_in'" class="text-xs opacity-70 mt-0.5">
                  Checked in on {{ formatDateTime(lastResult.registration?.checkedInAt) }}
                </p>
              </div>
            </div>
          </div>

          <!-- Guest details (when found) -->
          <template v-if="lastResult.registration">
            <div class="space-y-2.5">
              <!-- Name + initials -->
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full border border-gold-500/25 bg-gold-500/10 flex items-center justify-center text-sm font-semibold text-gold-300 flex-shrink-0">
                  {{ (lastResult.registration.name || '?').trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase() }}
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-medium text-bone-200">{{ lastResult.registration.name }}</p>
                  <p class="text-xs text-bone-500 truncate">{{ lastResult.registration.email }}</p>
                </div>
              </div>

              <div class="rounded-xl border border-maroon-700/60 bg-maroon-950/40 divide-y divide-maroon-800/60">
                <div class="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <span class="text-bone-400 text-xs">Workshop</span>
                  <span class="text-bone-200 text-right">{{ lastResult.registration.eventTitle || '—' }}</span>
                </div>
                <div class="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <span class="text-bone-400 text-xs">Vocal range</span>
                  <span class="text-bone-200">{{ lastResult.registration.vocalRange || '—' }}</span>
                </div>
                <div class="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <span class="text-bone-400 text-xs">Reg. ID</span>
                  <span class="font-mono text-gold-300/80 text-xs">{{ lastResult.registration.registrationId || '—' }}</span>
                </div>
                <div class="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <span class="text-bone-400 text-xs">Ticket ID</span>
                  <span class="font-mono text-gold-300/80 text-xs break-all text-right max-w-[9rem]">{{ lastResult.registration.ticketId || '—' }}</span>
                </div>
                <div v-if="lastResult.status === 'already_checked_in'" class="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <span class="text-bone-400 text-xs">Scanned by</span>
                  <span class="text-bone-200 text-xs text-right">{{ lastResult.registration.checkedInByName || lastResult.registration.checkedInBy || '—' }}</span>
                </div>
              </div>
            </div>
          </template>

          <!-- Raw ticket ID (always shown) -->
          <div class="rounded-xl border border-maroon-700/60 bg-maroon-950/40 px-3 py-2.5">
            <p class="text-[10px] uppercase tracking-[0.2em] text-bone-500 mb-1">Scanned value</p>
            <p class="font-mono text-xs text-gold-300/80 break-all">{{ lastRawValue }}</p>
          </div>

          <!-- Scan next button -->
          <button
            type="button"
            class="w-full py-2.5 rounded-xl border border-gold-500/30 text-sm font-medium text-gold-300 hover:bg-gold-500/10 transition-colors"
            @click="lastResult = null; lastRawValue = ''; scanError = ''; resetCooldown()"
          >
            Scan next guest
          </button>
        </div>
      </section>
    </div>

    <!-- Guidance callout -->
    <div class="rounded-2xl border border-maroon-700/60 glass-card p-4 sm:p-5">
      <h3 class="text-xs uppercase tracking-[0.25em] text-gold-400/70 mb-3">How it works</h3>
      <ul class="space-y-2 text-sm text-bone-400">
        <li class="flex items-start gap-2.5">
          <span class="mt-0.5 w-4 h-4 rounded-full bg-gold-500/20 border border-gold-500/30 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-gold-300">1</span>
          Press <span class="text-bone-200 font-medium mx-1">Start camera</span> and allow camera access when the browser asks.
        </li>
        <li class="flex items-start gap-2.5">
          <span class="mt-0.5 w-4 h-4 rounded-full bg-gold-500/20 border border-gold-500/30 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-gold-300">2</span>
          Point the camera at the QR code on the audience's ticket. The result appears on the right automatically.
        </li>
        <li class="flex items-start gap-2.5">
          <span class="mt-0.5 w-4 h-4 rounded-full bg-gold-500/20 border border-gold-500/30 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-gold-300">3</span>
          Each ticket can only be scanned once — a second scan will show <span class="text-amber-300 font-medium mx-1">Already checked in</span> without overwriting the first check-in record.
        </li>
      </ul>
    </div>

  </div>
</template>
