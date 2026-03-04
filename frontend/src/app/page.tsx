"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { LoaderCircle, Upload } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
	videos: VideoResult[];
};

type ApiResponse<T> = {
	message?: string;
	data?: T;
};

type CompressionSettings = {
	codec: string;
	crf: string;
	preset: string;
	resolution: string;
};

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080").replace(/\/$/, "");

const defaultSettings: CompressionSettings = {
	codec: "libx265",
	crf: "28",
	preset: "medium",
	resolution: "original",
};

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

function formatCompression(ratio: number) {
	if (!Number.isFinite(ratio) || ratio <= 0) {
		return "0%";
	}

	const delta = Math.round(Math.abs(1 - ratio) * 100);
	return ratio <= 1 ? `${delta}% smaller` : `${delta}% larger`;
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
	const [files, setFiles] = useState<File[]>([]);
	const [settings, setSettings] = useState<CompressionSettings>(defaultSettings);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [report, setReport] = useState<BatchReport | null>(null);
	const [error, setError] = useState<string | null>(null);

	function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
		setFiles(Array.from(event.target.files ?? []));
		setError(null);
	}

	function updateSetting<K extends keyof CompressionSettings>(key: K, value: CompressionSettings[K]) {
		setSettings((current) => ({ ...current, [key]: value }));
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (files.length === 0) {
			setError("Select at least one video.");
			return;
		}

		setIsSubmitting(true);
		setError(null);
		setReport(null);

		const formData = new FormData();
		for (const file of files) {
			formData.append("files", file);
		}

		formData.append("codec", settings.codec);
		formData.append("crf", settings.crf);
		formData.append("preset", settings.preset);
		if (settings.resolution !== "original") {
			formData.append("resolution", settings.resolution);
		}

		try {
			const response = await fetch(`${API_BASE_URL}/batch`, {
				method: "POST",
				body: formData,
			});

			const payload = (await response.json()) as ApiResponse<BatchReport>;
			if (!response.ok || !payload.data) {
				throw new Error(payload.message || "Batch request failed.");
			}

			setReport(payload.data);
		} catch (caughtError) {
			setError(caughtError instanceof Error ? caughtError.message : "Unexpected request failure.");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-10 sm:px-6">
			<Card className="border-slate-200 bg-white/90">
				<CardHeader className="gap-3">
					<Badge variant="outline" className="w-fit rounded-full">
						Shrinkly
					</Badge>
					<CardTitle className="text-3xl">Bulk Video Compression</CardTitle>
					<p className="text-sm text-slate-600">
						One page only: choose files, adjust compression settings, submit batch, review result.
					</p>
				</CardHeader>
				<CardContent className="space-y-6">
					<form className="space-y-6" onSubmit={handleSubmit}>
						<div className="space-y-2">
							<Label htmlFor="files">Videos</Label>
							<Input
								id="files"
								type="file"
								accept="video/*"
								multiple
								disabled={isSubmitting}
								onChange={handleFilesChange}
								className="h-auto py-3"
							/>
							<p className="text-xs text-slate-500">{files.length} file(s) selected</p>
						</div>

						<div className="grid gap-4 md:grid-cols-2">
							<div className="space-y-2">
								<Label>Codec</Label>
								<Select
									value={settings.codec}
									onValueChange={(value) => updateSetting("codec", value)}
									disabled={isSubmitting}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Select codec" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="libx265">H.265 / libx265</SelectItem>
										<SelectItem value="libx264">H.264 / libx264</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<Label htmlFor="crf">CRF</Label>
								<Input
									id="crf"
									type="number"
									min="0"
									max="51"
									value={settings.crf}
									disabled={isSubmitting}
									onChange={(event) => updateSetting("crf", event.target.value)}
								/>
							</div>

							<div className="space-y-2">
								<Label>Preset</Label>
								<Select
									value={settings.preset}
									onValueChange={(value) => updateSetting("preset", value)}
									disabled={isSubmitting}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Select preset" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="ultrafast">ultrafast</SelectItem>
										<SelectItem value="fast">fast</SelectItem>
										<SelectItem value="medium">medium</SelectItem>
										<SelectItem value="slow">slow</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<Label>Resolution</Label>
								<Select
									value={settings.resolution}
									onValueChange={(value) => updateSetting("resolution", value)}
									// disabled={isSubmitting}
									disabled
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Select resolution" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="original">Original</SelectItem>
										<SelectItem value="1080">1080p</SelectItem>
										<SelectItem value="720">720p</SelectItem>
										<SelectItem value="480">480p</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="flex flex-col gap-3 sm:flex-row">
							<Button type="submit" disabled={isSubmitting || files.length === 0}>
								{isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
								{isSubmitting ? "Processing..." : "Upload And Compress"}
							</Button>
							<Button
								type="button"
								variant="outline"
								disabled={isSubmitting}
								onClick={() => {
									setFiles([]);
									setSettings(defaultSettings);
									setReport(null);
									setError(null);
								}}
							>
								Reset
							</Button>
						</div>
					</form>

					{error ? (
						<Alert variant="destructive">
							<AlertTitle>Request failed</AlertTitle>
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					) : null}

					{report ? (
						<div className="space-y-4 rounded-xl border border-slate-200 p-4">
							<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<h2 className="text-lg font-semibold">Batch #{report.batch_id}</h2>
									<p className="text-sm text-slate-600">
										{report.processed_files}/{report.total_files} processed, {report.failed_count} failed
									</p>
								</div>
								<Badge variant={getStatusVariant(report.status)}>{report.status}</Badge>
							</div>

							<div className="grid gap-3 sm:grid-cols-3">
								<div className="rounded-lg bg-slate-50 p-3">
									<p className="text-xs text-slate-500">Original</p>
									<p className="text-base font-semibold">{formatBytes(report.total_original_size)}</p>
								</div>
								<div className="rounded-lg bg-slate-50 p-3">
									<p className="text-xs text-slate-500">Optimized</p>
									<p className="text-base font-semibold">{formatBytes(report.total_optimized_size)}</p>
								</div>
								<div className="rounded-lg bg-slate-50 p-3">
									<p className="text-xs text-slate-500">Compression</p>
									<p className="text-base font-semibold">{formatCompression(report.compression_ratio)}</p>
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
									{report.videos.map((video) => (
										<TableRow key={video.video_id}>
											<TableCell className="max-w-56 truncate">{video.filename}</TableCell>
											<TableCell>
												<Badge variant={getStatusVariant(video.status)}>{video.status}</Badge>
											</TableCell>
											<TableCell>{formatBytes(video.original_size)}</TableCell>
											<TableCell>{formatBytes(video.optimized_size)}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					) : null}
				</CardContent>
			</Card>
		</main>
	);
}
