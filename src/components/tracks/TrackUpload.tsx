import React, { useRef } from "react";

export default function TrackUpload({ onUpload }: { onUpload?: (result: any) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const formData = new FormData();
    for (const file of Array.from(files)) {
      formData.append("files", file);
    }
    // Voeg eventueel workspaceId toe
    // formData.append("workspaceId", "<id>");
    try {
      const res = await fetch("/api/tracks", {
        method: "POST",
        body: formData,
        // GEEN content-type header zetten!
      });
      const data = await res.json();
      if (onUpload) onUpload(data);
      if (!res.ok) {
        alert(data.error || "Upload mislukt");
      }
    } catch (err) {
      alert("Upload error: " + err);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="audio/mp3,audio/wav"
        onChange={handleUpload}
        style={{ display: "none" }}
        id="track-upload-input"
      />
      <label htmlFor="track-upload-input" className="btn-primary cursor-pointer">
        Tracks uploaden
      </label>
    </div>
  );
}
