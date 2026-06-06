import { useState, useRef } from "react";
import { Camera, FileVideo, Check, AlertTriangle, Loader2 } from "lucide-react";

interface VideoUploaderProps {
  onVideoSelected: (video: { name: string; size: string; duration: string } | null) => void;
  onSkip: () => void;
  onBack: () => void;
  initialVideo?: { name: string; size: string; duration: string } | null;
}

export function VideoUploader({ onVideoSelected, onSkip, onBack, initialVideo }: VideoUploaderProps) {
  const [video, setVideo] = useState<{ name: string; size: string; duration: string } | null>(initialVideo || null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const simulateUpload = (fileName: string, fileSize: number) => {
    setUploading(true);
    setUploadProgress(0);
    const sizeStr = `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setUploading(false);
            const newVideo = {
              name: fileName,
              size: sizeStr,
              duration: "1m 22s",
            };
            setVideo(newVideo);
          }, 0);
          return 100;
        }
        return prev + 25;
      });
    }, 20);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Basic size validation: 250MB limit
      if (file.size > 250 * 1024 * 1024) {
        alert("File size exceeds 250MB limit.");
        return;
      }
      simulateUpload(file.name, file.size);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.size > 250 * 1024 * 1024) {
        alert("File size exceeds 250MB limit.");
        return;
      }
      simulateUpload(file.name, file.size);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const recordMockVideo = () => {
    simulateUpload("recorded-walkthrough.mp4", 45 * 1024 * 1024);
  };

  const clearVideo = () => {
    setVideo(null);
    onVideoSelected(null);
  };

  return (
    <div className="w-full">
      <div className="step-area__head mb-6">
        <div className="step-area__step-num text-[11.5px] font-mono tracking-wider text-brand-primary font-bold mb-1.5">
          STEP 2 OF 5
        </div>
        <h2 className="step-area__title text-2xl sm:text-3xl font-extrabold text-brand-text mb-2 tracking-tight">
          Walk your fence line on video
        </h2>
        <p className="step-area__lede text-brand-muted text-sm sm:text-base max-w-[540px] leading-relaxed">
          Record 60–90 seconds showing what the installer will be walking into. They watch this before accepting and use it to plan the day. Most jobs don't need a site visit after this.
        </p>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="video/mp4,video/quicktime,video/x-m4v,video/*"
        className="hidden"
      />

      {/* Upload / Drop zone */}
      {!video && !uploading && (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            triggerFileInput();
          }}
          className={`video-zone border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            dragActive
              ? "border-brand-primary bg-brand-primary/10"
              : "border-brand-primary/40 bg-brand-primary/5 hover:bg-brand-primary/10"
          }`}
          data-testid="video-drop-zone"
        >
          <div className="video-zone__icon text-4xl mb-3">🎥</div>
          <div className="video-zone__title text-base sm:text-lg font-bold text-brand-text mb-1">
            Drop a video, or record one now
          </div>
          <div className="video-zone__sub text-xs text-brand-muted max-w-[420px] mx-auto mb-4 leading-normal">
            MP4 or MOV · up to 250 MB · uploaded over your wifi · stays private to Amazing Fencing
          </div>
          <div className="video-zone__btns flex justify-center gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                recordMockVideo();
              }}
              className="video-zone__btn bg-brand-primary text-white font-semibold text-xs py-2 px-4 rounded hover:bg-brand-primary-hover transition flex items-center gap-1.5"
            >
              <Camera size={14} />
              Record now
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerFileInput();
              }}
              className="video-zone__btn video-zone__btn--secondary bg-transparent border border-brand-primary text-brand-primary font-semibold text-xs py-2 px-4 rounded hover:bg-brand-primary/10 transition flex items-center gap-1.5"
            >
              <FileVideo size={14} />
              Choose a file
            </button>
          </div>
        </div>
      )}

      {/* Uploading progress bar */}
      {uploading && (
        <div className="border border-brand-border rounded-xl p-8 text-center bg-brand-card shadow-sm mb-4">
          <Loader2 size={32} className="animate-spin text-brand-primary mx-auto mb-3" />
          <div className="text-sm font-semibold text-brand-text mb-1">Uploading video...</div>
          <div className="w-full max-w-[280px] mx-auto bg-brand-border h-2 rounded-full overflow-hidden mb-2">
            <div
              className="bg-brand-primary h-full transition-all duration-100"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <div className="text-xs text-brand-muted font-mono">{uploadProgress}% complete</div>
        </div>
      )}

      {/* Uploaded video preview card */}
      {video && !uploading && (
        <div className="border border-brand-border rounded-xl p-5 bg-brand-card shadow-sm mb-4 flex items-start gap-4">
          <div className="w-16 h-10 bg-slate-900 rounded flex items-center justify-center text-white text-xs shrink-0 select-none">
            ▶
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="text-sm font-bold text-brand-text truncate">{video.name}</div>
            <div className="text-xs text-brand-muted font-mono mt-1">
              {video.duration} · {video.size} · uploaded <Check size={12} className="inline text-brand-success ml-0.5" />
            </div>
          </div>
          <button
            type="button"
            onClick={clearVideo}
            className="text-xs text-brand-danger hover:underline font-semibold"
          >
            Remove
          </button>
        </div>
      )}

      {/* Tips list */}
      <div className="video-tips bg-brand-card border border-brand-border rounded-lg p-4 mb-4 select-none">
        <div className="video-tips__title text-[11px] tracking-wider uppercase font-bold text-brand-text mb-2 flex items-center gap-1.5">
          <span>📝</span> What to show in the video
        </div>
        <ul className="video-tips__list space-y-1 text-xs sm:text-sm text-brand-muted leading-relaxed">
          <li className="video-tips__item flex items-start gap-2">
            <span className="text-brand-success font-bold shrink-0">✓</span>
            <span>Walk the full fence line — corner to corner, including gates</span>
          </li>
          <li className="video-tips__item flex items-start gap-2">
            <span className="text-brand-success font-bold shrink-0">✓</span>
            <span>Show neighbouring fences (condition, height, materials touching the boundary)</span>
          </li>
          <li className="video-tips__item flex items-start gap-2">
            <span className="text-brand-success font-bold shrink-0">✓</span>
            <span>Point out any trees, sloped ground, or tight access for materials</span>
          </li>
          <li className="video-tips__item flex items-start gap-2">
            <span className="text-brand-success font-bold shrink-0">✓</span>
            <span>Show where the materials can be dropped off (driveway, side gate, etc.)</span>
          </li>
          <li className="video-tips__item flex items-start gap-2">
            <span className="text-brand-success font-bold shrink-0">✓</span>
            <span>If there's an existing fence to remove, walk along it once</span>
          </li>
        </ul>
      </div>

      {/* Skip with warning caveat */}
      <div className="skip-row text-center py-2 mb-4">
        <button
          type="button"
          onClick={onSkip}
          className="skip-row__link text-xs text-brand-muted underline hover:text-brand-text"
        >
          I'll send the video later
        </button>
        <div className="skip-row__note text-[11px] text-amber-600 flex items-center justify-center gap-1 mt-1 font-medium select-none">
          <AlertTriangle size={12} className="shrink-0" />
          Heads up — Installer won't confirm the install date until they've seen the video.
        </div>
      </div>

      {/* CTA buttons */}
      <div className="cta-row flex gap-3 pt-4 border-t border-brand-border">
        <button
          type="button"
          onClick={onBack}
          className="cta-btn cta-btn--secondary bg-transparent border border-brand-border text-brand-text font-semibold text-xs py-2.5 px-4 rounded hover:bg-brand-soft transition"
        >
          ← Back
        </button>
        <button
          type="button"
          disabled={!video}
          onClick={() => {
            if (video) onVideoSelected(video);
          }}
          className={`cta-btn cta-btn--full bg-brand-primary text-white font-bold text-xs py-2.5 px-6 rounded transition flex-1 text-center justify-center ${
            !video ? "opacity-40 cursor-not-allowed" : "hover:bg-brand-primary-hover"
          }`}
        >
          Upload a video to continue →
        </button>
      </div>
    </div>
  );
}
