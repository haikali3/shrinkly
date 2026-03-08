"use client"

import {
  ChevronDown,
  Cog,
  FileVideo2,
  LoaderCircle,
  Upload,
} from "lucide-react"
import { useEffect, useRef, useState, type DragEvent } from "react"

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
  const [options, setOptions] = useState<CompressionOptions>(fallbackOptions)
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [batchId, setBatchId] = useState<number | null>(null)
  const [report, setReport] = useState<BatchReport | null>(null)

  const [codec, setCodec] = useState("libx265")
  const [preset, setPreset] = useState("medium")
  const [crf, setCrf] = useState(32)
  const [resolution, setResolution] =
    useState<(typeof resolutionOptions)[number]["value"]>("")
  const [bitrate, setBitrate] = useState("")

  useEffect(() => {
    let cancelled = false

    async function loadOptions() {
      try {
        setOptionsLoading(true)
        setOptionsError(null)

        const response = await fetch(`${API_BASE_URL}/options`, {
          method: "GET",
        })

        const payload =
          (await response.json()) as ApiResponse<CompressionOptions>
        if (!response.ok || !payload.data) {
          throw new Error(
            payload.message || "Failed to load compression options"
          )
        }

        if (cancelled) return

        setOptions(payload.data)
        setCodec((current) =>
          payload.data?.codecs.includes(current)
            ? current
            : (payload.data?.codecs[0] ?? fallbackOptions.codecs[0])
        )
        setPreset((current) =>
          payload.data?.presets.includes(current)
            ? current
            : (payload.data?.presets[0] ?? fallbackOptions.presets[0])
        )
        setCrf((current) => {
          const min =
            payload.data?.crf_range.min ?? fallbackOptions.crf_range.min
          const max =
            payload.data?.crf_range.max ?? fallbackOptions.crf_range.max
          return Math.min(Math.max(current, min), max)
        })
      } catch (error) {
        if (cancelled) return

        setOptions(fallbackOptions)
        setOptionsError(
          error instanceof Error
            ? error.message
            : "Failed to load compression options"
        )
      } finally {
        if (!cancelled) {
          setOptionsLoading(false)
        }
      }
    }

    loadOptions()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (batchId === null) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    async function pollBatch() {
      try {
        const response = await fetch(`${API_BASE_URL}/batch/${batchId}`, {
          method: "GET",
        })
        const payload = (await response.json()) as ApiResponse<BatchReport>

        if (!response.ok || !payload.data) {
          throw new Error(payload.message || "Failed to fetch batch status")
        }

        if (cancelled) return

        setReport(payload.data)

        if (
          payload.data.status !== "completed" &&
          payload.data.status !== "failed"
        ) {
          timer = setTimeout(pollBatch, 1500)
        }
      } catch (error) {
        if (cancelled) return
        setSubmitError(
          error instanceof Error ? error.message : "Failed to poll batch"
        )
      }
    }

    pollBatch()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [batchId])

  async function handleUpload() {
    if (selectedFiles.length === 0) {
      setSubmitError("Choose at least one video file first.")
      return
    }

    try {
      setIsSubmitting(true)
      setSubmitError(null)
      setReport(null)
      setBatchId(null)

      const formData = new FormData()
      formData.set("codec", codec)
      formData.set("preset", preset)
      formData.set("crf", String(crf))
      formData.set("resolution", resolution)
      formData.set("bitrate", bitrate)

      for (const file of selectedFiles) {
        formData.append("files", file)
      }

      const response = await fetch(`${API_BASE_URL}/batch`, {
        method: "POST",
        body: formData,
      })
      const payload = (await response.json()) as ApiResponse<BatchReport>

      if (!response.ok || !payload.data) {
        throw new Error(payload.message || "Failed to create batch")
      }

      setBatchId(payload.data.batch_id)
      setReport(payload.data)
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to upload video"
      )
    } finally {
      setIsSubmitting(false)
    }
  }

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
    setSubmitError(null)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    handleFiles(event.dataTransfer.files)
  }

  const minCrf = options.crf_range.min ?? fallbackOptions.crf_range.min
  const maxCrf = options.crf_range.max ?? fallbackOptions.crf_range.max
  const totalSelectedSize = selectedFiles.reduce(
    (sum, file) => sum + file.size,
    0
  )

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
                  disabled={isSubmitting || selectedFiles.length === 0}
                >
                  {isSubmitting ? (
                    <>
                      <LoaderCircle className="size-4 animate-spin" />
                      Uploading...
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

              {submitError ? (
                <p className="mt-4 text-sm text-red-600 dark:text-red-400">
                  {submitError}
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

              {optionsError ? (
                <p className="mt-4 text-sm text-amber-700 dark:text-amber-400">
                  {optionsError}. Showing fallback values.
                </p>
              ) : null}

              <div className="mt-6 space-y-6">
                <Field
                  label="Video codec"
                  hint="Choose the video format you want to use."
                >
                  <select
                    value={codec}
                    onChange={(event) => setCodec(event.target.value)}
                    disabled={optionsLoading}
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
                    value={preset}
                    onChange={(event) => setPreset(event.target.value)}
                    disabled={optionsLoading}
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
                        {crf}
                      </span>
                      <span className="text-stone-500 dark:text-stone-400">
                        {crf <= 20
                          ? "Higher quality"
                          : crf <= 28
                            ? "Balanced"
                            : "Smaller size"}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={minCrf}
                      max={maxCrf}
                      step="1"
                      value={crf}
                      onChange={(event) => setCrf(Number(event.target.value))}
                      className="w-full accent-primary"
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
                      Waiting for output
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
