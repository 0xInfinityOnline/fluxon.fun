import { useState } from 'react';
import { useAppStore } from '../store';
import { useI18n } from '../lib/i18n';

interface FileUploadProps {
  onUploadComplete: () => void;
}

export function CSVUpload({ onUploadComplete }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { setLoading, setError, token } = useAppStore();
  const { t } = useI18n();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    await uploadFile(file);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await uploadFile(e.target.files[0]);
    }
  };

  const uploadFile = async (file: File) => {
    if (!file || !file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }
    if (!token) {
      setError('You must be logged in to upload files');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:3001/api/csv/upload', {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      onUploadComplete();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-8 text-center ${
        isDragging ? 'border-green-500/70 bg-green-950/20' : 'border-gray-300'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="space-y-4">
        <div className="text-lg font-medium">
          {t('dropHereOrBrowse')} {' '}
          <label className="text-green-400 cursor-pointer hover:text-green-300">
            {t('browse')}
            <input
              type="file"
              className="hidden"
              accept=".csv"
              onChange={handleFileSelect}
            />
          </label>
        </div>
        <div className="text-left text-sm text-green-500/80 space-y-1">
          <p><strong>{t('csvSupportTitle')}</strong></p>
          <p>{t('acceptedFormats')}</p>
          <ul className="list-disc pl-5">
            <li>{t('overviewCols')}</li>
            <li>{t('postsCols')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
