import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { registerAndLoadFile } from '../database/duckdb';
import { useWorkspaceStore } from '../state/useWorkspaceStore';
import { CustomFileImport } from '../types';

export interface FileDropzoneProps {
  onFileLoaded?: (customImport: CustomFileImport) => void;
  className?: string;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({ onFileLoaded, className = '' }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setError(null);
    setSuccessMessage(null);

    const fileName = file.name;
    const ext = fileName.split('.').pop()?.toLowerCase();

    let format: 'csv' | 'json' | 'parquet' | null = null;
    if (ext === 'csv') format = 'csv';
    else if (ext === 'json') format = 'json';
    else if (ext === 'parquet') format = 'parquet';

    if (!format) {
      setError(`Unsupported file type ".${ext}". Please upload a .csv, .json, or .parquet file.`);
      return;
    }

    setIsLoading(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      const result = await registerAndLoadFile(fileName, buffer, format);

      // Refresh global schema state in workspace store
      await useWorkspaceStore.getState().loadSchema();

      setSuccessMessage(`Loaded table "${result.tableName}" (${result.rowCount} rows)`);

      if (onFileLoaded) {
        onFileLoaded(result);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to import file into DuckDB');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      processFile(file);
    }
  };

  const handleClick = () => {
    if (!isLoading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className={`w-full text-xs font-sans ${className}`}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-accent bg-accent/10'
            : 'border-border hover:border-muted hover:bg-surface-secondary/50'
        } ${isLoading ? 'opacity-70 pointer-events-none' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json,.parquet"
          onChange={handleFileChange}
          className="hidden"
          data-testid="file-dropzone-input"
        />

        {isLoading ? (
          <div className="flex flex-col items-center gap-2 text-muted">
            <Loader2 size={24} className="animate-spin text-accent" />
            <span>Importing and registering file in DuckDB...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="p-2 rounded-full bg-surface-secondary text-accent">
              <Upload size={20} />
            </div>
            <div>
              <p className="font-semibold text-primary">Drop data files here, or click to browse</p>
              <p className="text-muted text-[11px] mt-0.5">Supports CSV, JSON, and Parquet formats</p>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-secondary border border-border text-secondary flex items-center gap-1">
                <FileText size={10} /> CSV
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-secondary border border-border text-secondary flex items-center gap-1">
                <FileText size={10} /> JSON
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-secondary border border-border text-secondary flex items-center gap-1">
                <FileText size={10} /> Parquet
              </span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-2 p-2 rounded bg-error/10 border border-error/20 text-error flex items-center gap-1.5 text-[11px]">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && !error && (
        <div className="mt-2 p-2 rounded bg-success/10 border border-success/20 text-success flex items-center gap-1.5 text-[11px]">
          <CheckCircle2 size={14} className="shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
    </div>
  );
};
