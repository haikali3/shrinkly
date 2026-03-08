export type ApiResponse<T> = {
  status_code?: number
  message?: string
  data?: T
}

export type CompressionOptions = {
  codecs: string[]
  presets: string[]
  crf_range: {
    min: number
    max: number
  }
}

export type VideoResult = {
  video_id: number
  filename: string
  original_size: number
  optimized_size: number
  status: string
}

export type BatchReport = {
  batch_id: number
  status: string
  total_files: number
  processed_files: number
  failed_count: number
  total_original_size: number
  total_optimized_size: number
  compression_ratio: number
  duration: number
  videos: VideoResult[]
}

export type CreateBatchInput = {
  files: File[]
  codec: string
  preset: string
  crf: number
  resolution: string
  bitrate: string
}

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:8080"

export const fallbackOptions: CompressionOptions = {
  codecs: ["libx264", "libx265", "libvpx-vp9"],
  presets: [
    "ultrafast",
    "superfast",
    "veryfast",
    "faster",
    "fast",
    "medium",
    "slow",
    "slower",
    "veryslow",
    "placebo",
  ],
  crf_range: {
    min: 0,
    max: 51,
  },
}

export const resolutionOptions = [
  { label: "Keep source", value: "" },
  { label: "1080p width", value: "1920:-2" },
  { label: "720p width", value: "1280:-2" },
  { label: "480p width", value: "854:-2" },
  { label: "360p width", value: "640:-2" },
] as const

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as ApiResponse<T>

  if (!response.ok || !payload.data) {
    throw new Error(payload.message || "Something went wrong.")
  }

  return payload.data
}

export async function getCompressionOptions() {
  const response = await fetch(`${API_BASE_URL}/options`)
  return parseResponse<CompressionOptions>(response)
}

export async function getBatchReport(batchId: number) {
  const response = await fetch(`${API_BASE_URL}/batch/${batchId}`)
  return parseResponse<BatchReport>(response)
}

export async function createBatch({
  files,
  codec,
  preset,
  crf,
  resolution,
  bitrate,
}: CreateBatchInput) {
  const formData = new FormData()
  formData.set("codec", codec)
  formData.set("preset", preset)
  formData.set("crf", String(crf))
  formData.set("resolution", resolution)
  formData.set("bitrate", bitrate)

  for (const file of files) {
    formData.append("files", file)
  }

  const response = await fetch(`${API_BASE_URL}/batch`, {
    method: "POST",
    body: formData,
  })

  return parseResponse<BatchReport>(response)
}

export function isTerminalStatus(status: string) {
  return status === "completed" || status === "failed"
}

export function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 B"

  const units = ["B", "KB", "MB", "GB", "TB"]
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )
  const value = bytes / 1024 ** exponent

  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`
}
