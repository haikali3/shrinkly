"use client"

import { ChevronDown, Cog, FileVideo2, Upload } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"

const codecOptions = ["libx264", "libx265", "vp9"] as const
const presetOptions = [
  "ultrafast",
  "superfast",
  "veryfast",
  "faster",
  "fast",
  "medium",
  "slow",
  "slower",
] as const
const resolutionOptions = [
  { label: "Keep source", value: "" },
  { label: "1080p width", value: "1920:-2" },
  { label: "720p width", value: "1280:-2" },
  { label: "480p width", value: "854:-2" },
  { label: "360p width", value: "640:-2" },
] as const

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
  const [showAdvanced, setShowAdvanced] = useState(true)
  const [codec, setCodec] = useState<(typeof codecOptions)[number]>("libx264")
  const [preset, setPreset] = useState<(typeof presetOptions)[number]>("medium")
  const [crf, setCrf] = useState(24)
  const [resolution, setResolution] =
    useState<(typeof resolutionOptions)[number]["value"]>("1280:-2")
  const [bitrate, setBitrate] = useState("1800k")

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
            Compress video files with a clean upload flow and optional encoder
            controls for CRF, preset, bitrate, resolution, and codec.
          </p>
        </div>

        <div className="rounded-3xl border border-stone-200 bg-card p-4 shadow-sm md:p-5 dark:border-stone-800">
          <div className="rounded-[28px] border-2 border-dashed border-stone-300 bg-stone-50/80 px-6 py-14 text-center dark:border-stone-700 dark:bg-stone-900/60">
            <div className="mx-auto flex max-w-md flex-col items-center">
              <div className="mb-5 rounded-full bg-primary/10 p-4 text-primary">
                <FileVideo2 className="size-7" />
              </div>
              <Button className="h-12 rounded-xl px-6 text-base font-medium">
                <Upload className="size-4" />
                Choose Video
              </Button>
              <p className="mt-4 text-sm text-stone-600 dark:text-stone-400">
                Drag and drop a file here or select one from your device.
              </p>
              <p className="mt-2 text-xs text-stone-500 dark:text-stone-500">
                This area can be wired to your upload endpoint later.
              </p>
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
                  Optional encoder tuning
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

              <div className="mt-6 space-y-6">
                <Field
                  label="Video codec"
                  hint="Maps to setting.Codec in backend/internal/worker/encoder.go."
                >
                  <select
                    value={codec}
                    onChange={(event) =>
                      setCodec(
                        event.target.value as (typeof codecOptions)[number]
                      )
                    }
                    className="h-12 w-full rounded-xl border border-stone-200 bg-background px-4 text-sm transition outline-none focus:border-primary dark:border-stone-700"
                  >
                    {codecOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="Preset"
                  hint="Compression speed versus efficiency tradeoff."
                >
                  <select
                    value={preset}
                    onChange={(event) =>
                      setPreset(
                        event.target.value as (typeof presetOptions)[number]
                      )
                    }
                    className="h-12 w-full rounded-xl border border-stone-200 bg-background px-4 text-sm transition outline-none focus:border-primary dark:border-stone-700"
                  >
                    {presetOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="CRF"
                  hint="Lower CRF keeps more quality and usually results in a larger file."
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
                      min="16"
                      max="40"
                      step="1"
                      value={crf}
                      onChange={(event) => setCrf(Number(event.target.value))}
                      className="w-full accent-primary"
                    />
                  </div>
                </Field>

                <Field
                  label="Resolution"
                  hint="Adds an ffmpeg scale filter when a value is selected."
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
                  hint="Optional bitrate cap passed through as setting.Bitrate."
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
      </section>
    </main>
  )
}
