"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import {
  ChevronDown,
  Cog,
  FileVideo2,
  LoaderCircle,
  Upload,
} from "lucide-react"
import { useRef, useState, type DragEvent } from "react"

import { Button } from "@/components/ui/button"

type ApiResponse<T> = {
  status_code?: number
  message?: string
  data?: T
}

type CompressionOptions = {
  codecs: string[]
  presets: string[]
  crf_range: {
    min: number
    max: number
  }
}

type VideoResult = {
  video_id: number
  filename: string
  original_size: number
  optimized_size: number
  status: string
}

type BatchReport = {
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

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ??
  "http://localhost:8080"

const fallbackOptions: CompressionOptions = {
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

const resolutionOptions = [
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

async function getCompressionOptions() {
  const response = await fetch(`${API_BASE_URL}/options`)
  return parseResponse<CompressionOptions>(response)
}

async function getBatchReport(batchId: number) {
  const response = await fetch(`${API_BASE_URL}/batch/${batchId}`)
  return parseResponse<BatchReport>(response)
}

async function createBatch({
  files,
  codec,
  preset,
  crf,
  resolution,
  bitrate,
}: {
  files: File[]
  codec: string
  preset: string
  crf: number
  resolution: string
  bitrate: string
}) {
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

function formatBytes(bytes: number) {
  if (bytes <= 0) return "0 B"

  const units = ["B", "KB", "MB", "GB", "TB"]
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )
  const value = bytes / 1024 ** exponent

  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`
}

function isTerminalStatus(status: string) {
  return status === "completed" || status === "failed"
}

function Field({
  label,
  hint,
  children,
}: Readonly<{
  label: string
  hint?: string
  children: React.ReactNode
}>) {
  return (
    <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)] md:items-start">
      <div className="pt-3 text-sm font-medium text-stone-700 dark:text-stone-300">
        {label}
      </div>
      <div className="grid gap-2">
        {children}
        {hint ? (
          <p className="text-sm leading-6 text-stone-500 dark:text-stone-400">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export default function Page() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showAdvanced, setShowAdvanced] = useState(true)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [codec, setCodec] = useState("libx265")
  const [preset, setPreset] = useState("medium")
  const [crf, setCrf] = useState(32)
  const [resolution, setResolution] =
    useState<(typeof resolutionOptions)[number]["value"]>("")
  const [bitrate, setBitrate] = useState("")

  const optionsQuery = useQuery({
    queryKey: ["compression-options"],
    queryFn: getCompressionOptions,
  })

  const uploadMutation = useMutation({
    mutationFn: createBatch,
  })

  const batchId = uploadMutation.data?.batch_id

  const reportQuery = useQuery({
    queryKey: ["batch-report", batchId],
    queryFn: () => getBatchReport(batchId as number),
    enabled: batchId !== undefined,
    placeholderData: uploadMutation.data,
    refetchInterval: (query) => {
      const report = query.state.data as BatchReport | undefined
      return report && isTerminalStatus(report.status) ? false : 1500
    },
  })

  const options = optionsQuery.data ?? fallbackOptions
  const codecValue = options.codecs.includes(codec)
    ? codec
    : (options.codecs[0] ?? fallbackOptions.codecs[0])
  const presetValue = options.presets.includes(preset)
    ? preset
    : (options.presets[0] ?? fallbackOptions.presets[0])
  const minCrf = options.crf_range.min ?? fallbackOptions.crf_range.min
  const maxCrf = options.crf_range.max ?? fallbackOptions.crf_range.max
  const crfValue = Math.min(Math.max(crf, minCrf), maxCrf)
  const report = reportQuery.data ?? uploadMutation.data ?? null
  const totalSelectedSize = selectedFiles.reduce(
    (sum, file) => sum + file.size,
    0
  )
  const userError =
    optionsQuery.error?.message ||
    uploadMutation.error?.message ||
    reportQuery.error?.message ||
    null

  function handleFiles(files: FileList | null) {
    if (!files) return

    setSelectedFiles((current) => {
      const next = [...current]
      const seen = new Set(current.map((file) => `${file.name}-${file.size}`))

      for (const file of Array.from(files)) {
        const key = `${file.name}-${file.size}`
        if (!seen.has(key)) {
          seen.add(key)
          next.push(file)
        }
      }

      return next
    })

    uploadMutation.reset()
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    handleFiles(event.dataTransfer.files)
  }

  function handleUpload() {
    if (selectedFiles.length === 0) return

    uploadMutation.mutate({
      files: selectedFiles,
      codec: codecValue,
      preset: presetValue,
      crf: crfValue,
      resolution,
      bitrate,
    })
  }

  return (
    <main className="min-h-svh bg-background">
      <section className="mx-auto flex w-full max-w-5xl flex-col px-4 py-8 md:px-6 md:py-12">
        <div className="mb-10 text-center">
          <p className="text-sm font-medium tracking-[0.18em] text-primary uppercase">
            Shrinkly
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-stone-900 md:text-6xl dark:text-stone-50">
            Video Minify
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-stone-600 dark:text-stone-400">
            Upload your video, shrink the file size, and adjust quality only if
            you need to.
          </p>
        </div>

        <div className="rounded-3xl border border-stone-200 bg-card p-4 shadow-sm md:p-5 dark:border-stone-800">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={(event) => handleFiles(event.target.files)}
          />

          <div
            onDragEnter={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              if (event.currentTarget === event.target) {
                setIsDragging(false)
              }
            }}
            onDrop={handleDrop}
            className={`rounded-[28px] border-2 border-dashed px-6 py-14 text-center transition ${
              isDragging
                ? "border-primary bg-primary/8"
                : "border-stone-300 bg-stone-50/80 dark:border-stone-700 dark:bg-stone-900/60"
            }`}
          >
            <div className="mx-auto flex max-w-md flex-col items-center">
              <div className="mb-5 rounded-full bg-primary/10 p-4 text-primary">
                <FileVideo2 className="size-7" />
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  className="h-12 rounded-xl px-6 text-base font-medium"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-4" />
                  Choose Video
                </Button>
                <Button
                  className="h-12 rounded-xl px-6 text-base font-medium"
                  type="button"
                  onClick={handleUpload}
                  disabled={
                    uploadMutation.isPending ||
                    reportQuery.isFetching ||
                    selectedFiles.length === 0
                  }
                >
                  {uploadMutation.isPending ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Uploading...
                    </>
                  ) : reportQuery.isFetching && report ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Compressing...
                    </>
                  ) : (
                    "Compress Now"
                  )}
                </Button>
              </div>

              <p className="mt-4 text-sm text-stone-600 dark:text-stone-400">
                Drag and drop your video here, or choose it from your device.
              </p>
              <p className="mt-2 text-xs text-stone-500 dark:text-stone-500">
                You can upload more than one file at a time.
              </p>

              {selectedFiles.length > 0 ? (
                <div className="mt-5 w-full rounded-2xl bg-background p-4 text-left dark:bg-stone-950">
                  <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                    Selected files
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-stone-600 dark:text-stone-400">
                    {selectedFiles.map((file) => (
                      <li
                        key={`${file.name}-${file.size}`}
                        className="flex items-center justify-between gap-4"
                      >
                        <span className="truncate">{file.name}</span>
                        <span>{formatBytes(file.size)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-stone-500 dark:text-stone-500">
                    Total: {formatBytes(totalSelectedSize)}
                  </p>
                </div>
              ) : null}

              {userError ? (
                <p className="mt-4 text-sm text-red-600 dark:text-red-400">
                  {userError}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-stone-200 bg-card shadow-sm dark:border-stone-800">
          <button
            type="button"
            onClick={() => setShowAdvanced((value) => !value)}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-stone-100 p-2 text-stone-700 dark:bg-stone-900 dark:text-stone-300">
                <Cog className="size-4" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
                  Advanced settings
                </h2>
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  Optional quality controls
                </p>
              </div>
            </div>
            <ChevronDown
              className={`size-5 text-stone-500 transition-transform ${
                showAdvanced ? "rotate-180" : ""
              }`}
            />
          </button>

          {showAdvanced ? (
            <div className="border-t border-stone-200 px-5 py-5 dark:border-stone-800">
              <div className="rounded-2xl bg-stone-100 px-4 py-3 text-sm font-semibold text-stone-700 dark:bg-stone-900 dark:text-stone-200">
                Video Quality &amp; Size
              </div>

              {optionsQuery.isError ? (
                <p className="mt-4 text-sm text-amber-700 dark:text-amber-400">
                  Some settings could not be loaded, so default options are
                  being used instead.
                </p>
              ) : null}

              <div className="mt-6 space-y-6">
                <Field
                  label="Video codec"
                  hint="Choose the video format you want to use."
                >
                  <select
                    value={codecValue}
                    onChange={(event) => setCodec(event.target.value)}
                    disabled={optionsQuery.isLoading}
                    className="h-12 w-full rounded-xl border border-stone-200 bg-background px-4 text-sm transition outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-70 dark:border-stone-700"
                  >
                    {options.codecs.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="Preset"
                  hint="Controls how fast the compression runs."
                >
                  <select
                    value={presetValue}
                    onChange={(event) => setPreset(event.target.value)}
                    disabled={optionsQuery.isLoading}
                    className="h-12 w-full rounded-xl border border-stone-200 bg-background px-4 text-sm transition outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-70 dark:border-stone-700"
                  >
                    {options.presets.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="CRF"
                  hint={`Lower values keep more detail. Current range: ${minCrf}-${maxCrf}.`}
                >
                  <div className="rounded-2xl border border-stone-200 bg-background px-4 py-4 dark:border-stone-700">
                    <div className="mb-3 flex items-center justify-between text-sm">
                      <span className="font-medium text-stone-900 dark:text-stone-100">
                        {crfValue}
                      </span>
                      <span className="text-stone-500 dark:text-stone-400">
                        {crfValue <= 20
                          ? "Higher quality"
                          : crfValue <= 28
                            ? "Balanced"
                            : "Smaller size"}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={minCrf}
                      max={maxCrf}
                      step="1"
                      value={crfValue}
                      onChange={(event) => setCrf(Number(event.target.value))}
                      className="w-full accent-primary"
                      disabled={optionsQuery.isLoading}
                    />
                  </div>
                </Field>

                <Field
                  label="Resolution"
                  hint="Keep the original size, or scale the video down."
                >
                  <select
                    value={resolution}
                    onChange={(event) =>
                      setResolution(
                        event.target
                          .value as (typeof resolutionOptions)[number]["value"]
                      )
                    }
                    className="h-12 w-full rounded-xl border border-stone-200 bg-background px-4 text-sm transition outline-none focus:border-primary dark:border-stone-700"
                  >
                    {resolutionOptions.map((option) => (
                      <option key={option.label} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="Bitrate"
                  hint="Optional. Use this if you want to cap file size more aggressively."
                >
                  <input
                    type="text"
                    value={bitrate}
                    onChange={(event) => setBitrate(event.target.value)}
                    placeholder="1800k"
                    className="h-12 w-full rounded-xl border border-stone-200 bg-background px-4 text-sm transition outline-none placeholder:text-stone-400 focus:border-primary dark:border-stone-700"
                  />
                </Field>
              </div>
            </div>
          ) : null}
        </div>

        {report ? (
          <div className="mt-6 rounded-3xl border border-stone-200 bg-card p-5 shadow-sm dark:border-stone-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
                  Batch status
                </h2>
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  Batch #{report.batch_id} • {report.status}
                </p>
              </div>
              <div className="text-right text-sm text-stone-600 dark:text-stone-400">
                <div>
                  {report.processed_files}/{report.total_files} processed
                </div>
                <div>{report.failed_count} failed</div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-stone-100 p-4 dark:bg-stone-900">
                <p className="text-xs tracking-[0.16em] text-stone-500 uppercase">
                  Original
                </p>
                <p className="mt-2 text-lg font-semibold text-stone-900 dark:text-stone-100">
                  {formatBytes(report.total_original_size)}
                </p>
              </div>
              <div className="rounded-2xl bg-stone-100 p-4 dark:bg-stone-900">
                <p className="text-xs tracking-[0.16em] text-stone-500 uppercase">
                  Optimized
                </p>
                <p className="mt-2 text-lg font-semibold text-stone-900 dark:text-stone-100">
                  {formatBytes(report.total_optimized_size)}
                </p>
              </div>
              <div className="rounded-2xl bg-stone-100 p-4 dark:bg-stone-900">
                <p className="text-xs tracking-[0.16em] text-stone-500 uppercase">
                  Compression ratio
                </p>
                <p className="mt-2 text-lg font-semibold text-stone-900 dark:text-stone-100">
                  {report.compression_ratio.toFixed(2)}%
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {report.videos.map((video) => (
                <div
                  key={video.video_id}
                  className="flex flex-col gap-3 rounded-2xl border border-stone-200 p-4 md:flex-row md:items-center md:justify-between dark:border-stone-800"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-stone-900 dark:text-stone-100">
                      {video.filename}
                    </p>
                    <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                      {video.status} • {formatBytes(video.original_size)} to{" "}
                      {formatBytes(video.optimized_size)}
                    </p>
                  </div>

                  {video.status === "completed" ? (
                    <a
                      href={`${API_BASE_URL}/download/${video.video_id}`}
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground"
                    >
                      Download
                    </a>
                  ) : (
                    <span className="text-sm text-stone-500 dark:text-stone-400">
                      Working on it
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  )
}
