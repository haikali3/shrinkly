"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import {
	ArrowRight,
	Clapperboard,
	Gauge,
	HardDrive,
	LoaderCircle,
	Sparkles,
	Upload,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

type VideoResult = {
	video_id: number;
	filename: string;
	original_size: number;
	optimized_size: number;
	status: string;
};

type BatchReport = {
	batch_id: number;
	status: string;
	total_files: number;
	processed_files: number;
	failed_count: number;
	total_original_size: number;
	total_optimized_size: number;
	compression_ratio: number;
	duration: number;
	videos: VideoResult[];
};

type ApiResponse<T> = {
	status_code?: number;
	message?: string;
	data?: T;
};

type RequestPhase = "idle" | "uploading" | "processing" | "success" | "error";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");

const mvpPillars = [
	"Batch video processing",
	"H264 to H265 conversion",
	"CRF-based compression",
	"Worker pool with concurrency limits",
];

const workflow = [
	"Bulk upload videos from the browser",
	"Create a batch record on the API",
	"Run FFmpeg through the backend worker pool",
	"Review compression report and per-file status",
];

function formatBytes(bytes: number) {
	if (bytes <= 0) {
		return "0 B";
	}

	const units = ["B", "KB", "MB", "GB", "TB"];
	let value = bytes;
	let unitIndex = 0;

	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex += 1;
	}

	return `${value.toFixed(value >= 100 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatRatio(ratio: number) {
	if (!Number.isFinite(ratio) || ratio <= 0) {
		return "0%";
	}

	const delta = Math.round(Math.abs(1 - ratio) * 100);

	if (ratio <= 1) {
		return `${delta}% smaller`;
	}

	return `${delta}% larger`;
}

function formatDuration(durationInNanoseconds: number) {
	if (!Number.isFinite(durationInNanoseconds) || durationInNanoseconds <= 0) {
		return "0s";
	}

	const totalSeconds = Math.max(1, Math.round(durationInNanoseconds / 1_000_000_000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;

	if (minutes === 0) {
		return `${seconds}s`;
	}

	return `${minutes}m ${seconds}s`;
}

function getPhaseMeta(phase: RequestPhase) {
	switch (phase) {
		case "uploading":
			return { label: "Uploading files", progress: 24 };
		case "processing":
			return { label: "Compression running on backend", progress: 72 };
		case "success":
			return { label: "Batch report ready", progress: 100 };
		case "error":
			return { label: "Request failed", progress: 100 };
		default:
			return { label: "Waiting for files", progress: 0 };
	}
}

function getStatusVariant(status: string) {
	if (status === "completed") {
		return "default" as const;
	}

	if (status === "failed") {
		return "destructive" as const;
	}

	return "secondary" as const;
}

export default function Home() {
	const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
	const [phase, setPhase] = useState<RequestPhase>("idle");
	const [report, setReport] = useState<BatchReport | null>(null);
	const [error, setError] = useState<string | null>(null);

	const phaseMeta = getPhaseMeta(phase);
	const isBusy = phase === "uploading" || phase === "processing";

	function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
		const nextFiles = Array.from(event.target.files ?? []);
		setSelectedFiles(nextFiles);
		setError(null);
		if (phase === "success") {
			setReport(null);
			setPhase("idle");
		}
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (selectedFiles.length === 0) {
			setError("Select at least one video file before starting a batch.");
			setPhase("error");
			return;
		}

		setError(null);
		setReport(null);
		setPhase("uploading");

		const formData = new FormData();
		for (const file of selectedFiles) {
			formData.append("files", file);
		}

		const processingTimer = window.setTimeout(() => {
			setPhase((currentPhase) => (currentPhase === "uploading" ? "processing" : currentPhase));
		}, 700);

		try {
			const response = await fetch(`${API_BASE_URL}/batch`, {
				method: "POST",
				body: formData,
			});

			const payload = (await response.json()) as ApiResponse<BatchReport>;

			if (!response.ok || !payload.data) {
				throw new Error(payload.message || "The backend could not complete this batch.");
			}

			setReport(payload.data);
			setPhase("success");
		} catch (caughtError) {
			const message = caughtError instanceof Error ? caughtError.message : "Unexpected upload failure.";
			setError(message);
			setPhase("error");
		} finally {
			window.clearTimeout(processingTimer);
		}
	}

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 sm:px-10 lg:px-12">
			<section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur xl:p-12">
				<div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/70 to-transparent" />
				<div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
					<div className="space-y-6">
						<Badge variant="outline" className="rounded-full border-sky-200 bg-sky-50 px-3 py-1 text-sky-900">
							Bulk Video Minimizer
						</Badge>
						<div className="space-y-4">
							<h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
								Reduce video storage in bulk without turning the frontend into a job orchestrator.
							</h1>
							<p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
								This UI matches the current MVP in the PRD: upload a batch, let the Go worker pool run FFmpeg,
								then inspect the compression report once the backend returns.
							</p>
						</div>
						<div className="flex flex-wrap gap-3">
							{mvpPillars.map((pillar) => (
								<Badge
									key={pillar}
									variant="secondary"
									className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-slate-700"
								>
									{pillar}
								</Badge>
							))}
						</div>
					</div>
					<Card className="border-slate-200/80 bg-slate-950 text-slate-50 shadow-none">
						<CardHeader>
							<CardTitle className="flex items-center gap-3 text-xl">
								<Sparkles className="size-5 text-amber-300" />
								MVP Targets
							</CardTitle>
							<CardDescription className="text-slate-300">
								Focused on strong compression, predictable CPU usage, and usable batch reporting.
							</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
							<div className="rounded-2xl border border-white/10 bg-white/5 p-4">
								<p className="text-sm text-slate-300">Expected Reduction</p>
								<p className="mt-2 text-2xl font-semibold">30-60%</p>
							</div>
							<div className="rounded-2xl border border-white/10 bg-white/5 p-4">
								<p className="text-sm text-slate-300">Default Codec Path</p>
								<p className="mt-2 text-2xl font-semibold">H264 to H265</p>
							</div>
							<div className="rounded-2xl border border-white/10 bg-white/5 p-4">
								<p className="text-sm text-slate-300">Quality Strategy</p>
								<p className="mt-2 text-2xl font-semibold">CRF 26-28</p>
							</div>
						</CardContent>
					</Card>
				</div>
			</section>

			<section className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
				<Card className="border-white/70 bg-white/80 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
					<CardHeader>
						<CardTitle className="flex items-center gap-3 text-2xl">
							<Upload className="size-5 text-sky-600" />
							Start A Batch
						</CardTitle>
						<CardDescription className="text-slate-600">
							Submit multiple files as multipart form data under the <span className="font-mono">files</span>{" "}
							field. The current API responds only after backend processing completes.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						<form className="space-y-5" onSubmit={handleSubmit}>
							<div className="space-y-2">
								<label className="text-sm font-medium text-slate-800" htmlFor="video-files">
									Video Files
								</label>
								<Input
									id="video-files"
									type="file"
									accept="video/*"
									multiple
									disabled={isBusy}
									onChange={handleFileChange}
									className="h-auto rounded-2xl border-dashed border-slate-300 bg-slate-50 px-4 py-5 file:mr-4 file:rounded-full file:bg-slate-900 file:px-4 file:text-white hover:bg-slate-100"
								/>
							</div>
							<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
								<div className="flex items-center justify-between gap-3 text-sm">
									<span className="font-medium text-slate-900">{phaseMeta.label}</span>
									<span className="font-mono text-slate-500">{selectedFiles.length} file(s)</span>
								</div>
								<Progress value={phaseMeta.progress} className="mt-3 h-2.5 bg-slate-200" />
								<p className="mt-3 text-sm leading-6 text-slate-600">
									Upload progress is immediate. Compression progress is coarse because the current backend
									keeps the request open until the full batch finishes.
								</p>
							</div>
							<div className="flex flex-col gap-3 sm:flex-row">
								<Button
									type="submit"
									size="lg"
									disabled={isBusy || selectedFiles.length === 0}
									className="rounded-full bg-slate-950 px-6 text-white hover:bg-slate-800"
								>
									{isBusy ? <LoaderCircle className="size-4 animate-spin" /> : <Clapperboard className="size-4" />}
									{isBusy ? "Running Batch" : "Upload And Compress"}
								</Button>
								<Button
									type="button"
									variant="outline"
									size="lg"
									disabled={isBusy}
									onClick={() => {
										setSelectedFiles([]);
										setReport(null);
										setError(null);
										setPhase("idle");
									}}
									className="rounded-full border-slate-300 bg-white"
								>
									Reset Selection
								</Button>
							</div>
						</form>

						{selectedFiles.length > 0 ? (
							<div className="rounded-2xl border border-slate-200 bg-white p-4">
								<div className="flex items-center justify-between gap-3">
									<p className="text-sm font-medium text-slate-900">Batch Payload</p>
									<Badge variant="outline" className="rounded-full">
										{formatBytes(selectedFiles.reduce((total, file) => total + file.size, 0))}
									</Badge>
								</div>
								<div className="mt-3 space-y-2">
									{selectedFiles.map((file) => (
										<div
											key={`${file.name}-${file.lastModified}`}
											className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm"
										>
											<span className="truncate text-slate-700">{file.name}</span>
											<span className="font-mono text-slate-500">{formatBytes(file.size)}</span>
										</div>
									))}
								</div>
							</div>
						) : null}

						{error ? (
							<Alert variant="destructive">
								<AlertTitle>Batch Request Failed</AlertTitle>
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						) : null}
					</CardContent>
				</Card>

				<div className="grid gap-6">
					<div className="grid gap-4 sm:grid-cols-3">
						<Card className="border-white/70 bg-white/80 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
							<CardHeader className="gap-3">
								<HardDrive className="size-5 text-emerald-600" />
								<CardDescription>Total Original</CardDescription>
								<CardTitle className="text-2xl">
									{report ? formatBytes(report.total_original_size) : "Awaiting batch"}
								</CardTitle>
							</CardHeader>
						</Card>
						<Card className="border-white/70 bg-white/80 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
							<CardHeader className="gap-3">
								<Gauge className="size-5 text-sky-600" />
								<CardDescription>Compression</CardDescription>
								<CardTitle className="text-2xl">
									{report ? formatRatio(report.compression_ratio) : "No data"}
								</CardTitle>
							</CardHeader>
						</Card>
						<Card className="border-white/70 bg-white/80 shadow-[0_18px_40px_rgba(15,23,42,0.05)]">
							<CardHeader className="gap-3">
								<ArrowRight className="size-5 text-amber-600" />
								<CardDescription>Duration</CardDescription>
								<CardTitle className="text-2xl">
									{report ? formatDuration(report.duration) : "0s"}
								</CardTitle>
							</CardHeader>
						</Card>
					</div>

					<Card className="border-white/70 bg-white/80 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
						<CardHeader>
							<CardTitle className="text-2xl">Workflow Coverage</CardTitle>
							<CardDescription className="text-slate-600">
								This frontend tracks the exact MVP workflow from the PRD and stops short of fake live job control.
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							{workflow.map((step, index) => (
								<div
									key={step}
									className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
								>
									<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-medium text-white">
										{index + 1}
									</div>
									<p className="pt-1 text-sm leading-6 text-slate-700">{step}</p>
								</div>
							))}
						</CardContent>
					</Card>
				</div>
			</section>

			<section className="mt-8">
				<Card className="border-white/70 bg-white/85 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
					<CardHeader>
						<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
							<div>
								<CardTitle className="text-2xl">Batch Report</CardTitle>
								<CardDescription className="text-slate-600">
									Per-file status is the source of truth. The backend currently returns the final report after the
									batch is done.
								</CardDescription>
							</div>
							{report ? (
								<Badge variant={getStatusVariant(report.status)} className="rounded-full px-3 py-1 text-sm">
									Batch {report.status}
								</Badge>
							) : (
								<Badge variant="outline" className="rounded-full px-3 py-1 text-sm">
									No report yet
								</Badge>
							)}
						</div>
					</CardHeader>
					<CardContent className="space-y-5">
						<div className="grid gap-4 md:grid-cols-4">
							<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
								<p className="text-sm text-slate-500">Batch ID</p>
								<p className="mt-2 text-2xl font-semibold text-slate-950">{report?.batch_id ?? "-"}</p>
							</div>
							<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
								<p className="text-sm text-slate-500">Files</p>
								<p className="mt-2 text-2xl font-semibold text-slate-950">
									{report ? `${report.processed_files}/${report.total_files}` : "-"}
								</p>
							</div>
							<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
								<p className="text-sm text-slate-500">Optimized Size</p>
								<p className="mt-2 text-2xl font-semibold text-slate-950">
									{report ? formatBytes(report.total_optimized_size) : "-"}
								</p>
							</div>
							<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
								<p className="text-sm text-slate-500">Failed</p>
								<p className="mt-2 text-2xl font-semibold text-slate-950">{report?.failed_count ?? "-"}</p>
							</div>
						</div>

						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>File</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Original</TableHead>
									<TableHead>Optimized</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{report?.videos?.length ? (
									report.videos.map((video) => (
										<TableRow key={video.video_id}>
											<TableCell className="max-w-64 truncate font-medium">{video.filename}</TableCell>
											<TableCell>
												<Badge variant={getStatusVariant(video.status)} className="rounded-full">
													{video.status}
												</Badge>
											</TableCell>
											<TableCell className="font-mono">{formatBytes(video.original_size)}</TableCell>
											<TableCell className="font-mono">{formatBytes(video.optimized_size)}</TableCell>
										</TableRow>
									))
								) : (
									<TableRow>
										<TableCell colSpan={4} className="py-8 text-center text-sm text-slate-500">
											Run a batch to populate the report table.
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>

						<Alert>
							<AlertTitle>Backend Note</AlertTitle>
							<AlertDescription>
								Set <span className="font-mono">NEXT_PUBLIC_API_BASE_URL</span> if your Go API is not running on{" "}
								<span className="font-mono">http://localhost:8080</span>. If you later make the API async, this
								page can be extended with polling against <span className="font-mono">GET /batch/:id</span>.
							</AlertDescription>
						</Alert>
					</CardContent>
				</Card>
			</section>
		</main>
	);
}
