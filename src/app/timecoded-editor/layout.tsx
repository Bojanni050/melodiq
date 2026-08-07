import React from "react";
import TimecodedEditorLayout from "@/components/timecoded-editor/TimecodedEditorLayout";
import "./timecoded-editor.css";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <TimecodedEditorLayout>{children}</TimecodedEditorLayout>;
}
