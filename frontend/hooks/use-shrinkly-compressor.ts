"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useRef, useState, type DragEvent } from "react"

import {
  createBatch,
  fallbackOptions,
  getBatchReport,
  getCompressionOptions,
  isTerminalStatus,
  resolutionOptions,
} from "@/lib/shrinkly-api"

export function useShrinklyCompressor() {
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
      const report = query.state.data
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

  return {
    fileInputRef,
    showAdvanced,
    setShowAdvanced,
    selectedFiles,
    isDragging,
    setIsDragging,
    codecValue,
    setCodec,
    presetValue,
    setPreset,
    crfValue,
    setCrf,
    minCrf,
    maxCrf,
    resolution,
    setResolution,
    bitrate,
    setBitrate,
    options,
    optionsQuery,
    uploadMutation,
    reportQuery,
    report,
    totalSelectedSize,
    userError,
    handleFiles,
    handleDrop,
    handleUpload,
  }
}
