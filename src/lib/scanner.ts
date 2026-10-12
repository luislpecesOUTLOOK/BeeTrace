/** Mobile QR reader: rear camera first, framing guide, manual + image fallbacks. */
import jsQR from 'jsqr';

export type ScanState =
  | 'idle'
  | 'starting'
  | 'scanning'
  | 'denied'
  | 'no-camera'
  | 'unsupported'
  | 'insecure';

export interface ScannerHandles {
  onText: (text: string) => void;
  onState: (state: ScanState, detail?: string) => void;
}

function isSecure(): boolean {
  if (typeof location === 'undefined') return false;
  return (
    location.protocol === 'https:' ||
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1'
  );
}

export class QrScanner {
  private video: HTMLVideoElement;
  private canvas: HTMLCanvasElement;
  private stream: MediaStream | null = null;
  private raf = 0;
  private running = false;
  private lastText = '';
  private lastAt = 0;
  private deviceIds: string[] = [];
  private deviceIndex = 0;
  private handles: ScannerHandles;

  constructor(video: HTMLVideoElement, canvas: HTMLCanvasElement, handles: ScannerHandles) {
    this.video = video;
    this.canvas = canvas;
    this.handles = handles;
  }

  get active(): boolean {
    return this.running;
  }

  async start(deviceId?: string): Promise<void> {
    if (!('mediaDevices' in navigator) || !navigator.mediaDevices?.getUserMedia) {
      this.handles.onState('unsupported', 'Este navegador no puede acceder a la cámara.');
      return;
    }
    if (!isSecure()) {
      this.handles.onState(
        'insecure',
        'La cámara solo funciona con HTTPS. Usa la introducción manual o sube una imagen del QR.',
      );
      return;
    }
    this.stop();
    this.handles.onState('starting');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: { ideal: 'environment' } },
        audio: false,
      });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        this.handles.onState(
          'denied',
          'Permiso de cámara denegado. Actívalo en los ajustes del navegador o usa la introducción manual.',
        );
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        this.handles.onState('no-camera', 'No se encontró una cámara disponible en este dispositivo.');
      } else {
        this.handles.onState('no-camera', 'No se pudo abrir la cámara. Prueba con la introducción manual.');
      }
      return;
    }
    this.video.srcObject = this.stream;
    this.video.setAttribute('playsinline', 'true');
    try {
      await this.video.play();
    } catch {
      /* autoplay needs no handling beyond the play attempt */
    }
    await this.refreshDevices();
    this.running = true;
    this.lastText = '';
    this.handles.onState('scanning');
    this.loop();
  }

  private async refreshDevices(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.deviceIds = devices.filter((d) => d.kind === 'videoinput').map((d) => d.deviceId);
      const current = this.stream?.getVideoTracks()[0]?.getSettings().deviceId;
      this.deviceIndex = Math.max(0, this.deviceIds.indexOf(current ?? ''));
    } catch {
      this.deviceIds = [];
    }
  }

  canSwitch(): boolean {
    return this.deviceIds.length > 1;
  }

  async switchCamera(): Promise<void> {
    if (this.deviceIds.length < 2) return;
    this.deviceIndex = (this.deviceIndex + 1) % this.deviceIds.length;
    await this.start(this.deviceIds[this.deviceIndex]);
  }

  private loop = (): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const v = this.video;
    if (v.readyState !== v.HAVE_ENOUGH_DATA || v.videoWidth === 0) return;
    const scale = Math.min(1, 640 / v.videoWidth);
    const w = Math.floor(v.videoWidth * scale);
    const h = Math.floor(v.videoHeight * scale);
    const c = this.canvas;
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, w, h);
    const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, {
      inversionAttempts: 'attemptBoth',
    });
    if (found?.data) {
      const now = Date.now();
      // Same code within 3 s is ignored: no repeat processing.
      if (found.data === this.lastText && now - this.lastAt < 3000) return;
      this.lastText = found.data;
      this.lastAt = now;
      this.handles.onText(found.data);
    }
  };

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video.srcObject) this.video.srcObject = null;
  }
}

/** Decode a QR from an uploaded image file. Returns the text or null. */
export async function decodeImageFile(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, 1000 / img.naturalWidth);
    const w = Math.max(1, Math.floor(img.naturalWidth * scale));
    const h = Math.max(1, Math.floor(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, {
      inversionAttempts: 'attemptBoth',
    });
    return found?.data ?? null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = url;
  });
}
