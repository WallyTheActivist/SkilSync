import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Spinner, Table } from 'react-bootstrap';
import { AlertTriangle, CheckCircle2, Cloud, Database, Download, HardDrive, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../services/api';
import type { AdminBackup, AdminBackupStatus } from '../../types';
import { getBackupValidationLabel } from '../../utils/backupValidation.mjs';

const formatSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** unitIndex);
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatDate = (value: string | null): string => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString();
};

const BackupRecovery: React.FC = () => {
  const [backups, setBackups] = useState<AdminBackup[]>([]);
  const [status, setStatus] = useState<AdminBackupStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBackups = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.getBackups();
      if (!response.data.success) throw new Error('Backup history could not be loaded.');
      setBackups(response.data.data.backups);
      setStatus(response.data.data.status);
      setError(null);
    } catch {
      setError('Unable to load backup history. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBackups();
  }, [loadBackups]);

  const handleCreateBackup = async () => {
    if (!window.confirm('Create a new database backup now?')) return;

    setCreating(true);
    try {
      const response = await adminApi.createBackup();
      if (!response.data.success || !response.data.data?.backup) {
        throw new Error(response.data.message ?? 'Backup creation did not complete.');
      }
      setError(null);
      toast.success(response.data.message ?? 'Backup created successfully.');
      await loadBackups();
    } catch (err) {
      const responseMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      const message = responseMessage ?? (err instanceof Error ? err.message : 'Backup creation failed.');
      setError(message);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (id: string) => {
    setDownloadingId(id);
    try {
      const response = await adminApi.downloadBackup(id);
      const blob = new Blob([response.data], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const backup = backups.find((item) => item.id === id);
      const link = document.createElement('a');
      link.href = url;
      link.download = backup?.filename ?? id;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      let message = 'Unable to download backup. Please try again.';
      if (data instanceof Blob) {
        try {
          const parsed = JSON.parse(await data.text()) as { message?: string };
          if (parsed.message) message = parsed.message;
        } catch {
          message = 'Unable to download backup. Please try again.';
        }
      } else if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
        message = data.message;
      }
      setError(message);
      toast.error(message);
    } finally {
      setDownloadingId(null);
    }
  };

  const latestBackup = backups[0] ?? null;
  const totalAvailableBackups = backups.filter(
    (backup) => backup.filename !== null && backup.localStorageStatus === 'available',
  ).length;
  const historyLoadError = error?.startsWith('Unable to load backup history.') ?? false;
  const validationLabel = getBackupValidationLabel(latestBackup);
  const cloudStatusLabel = (() => {
    switch (status?.cloudSyncStatus) {
      case 'configured_but_unavailable':
        return 'Configured sync folder unavailable';
      case 'local_sync_folder_detected':
        return 'Local sync folder detected';
      case 'backup_copied_to_sync_folder':
        return 'SHA-256 matching local copy; cloud unverified';
      case 'not_independently_verified':
        return 'Not independently verified';
      default:
        return 'Not configured';
    }
  })();

  return (
    <div className="space-y-5 p-4 md:p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Admin</p>
          <h2 className="text-2xl font-semibold text-gray-900">Backup & Recovery</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline-secondary" onClick={() => void loadBackups()} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button variant="primary" onClick={() => void handleCreateBackup()} disabled={creating || loading}>
            {creating ? <Spinner animation="border" size="sm" className="me-2" /> : <Database size={16} className="me-2" />}
            {creating ? 'Creating backup…' : 'Create Database Backup'}
          </Button>
        </div>
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {creating && <div role="status" className="text-sm text-blue-700">Creating and validating the database backup. This may take a few minutes.</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="border-0 shadow-sm">
          <Card.Body>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <div className="text-xs uppercase text-muted">Total backups</div>
                <div className="mt-2 fs-3 fw-bold">{totalAvailableBackups}</div>
              </div>
              <Database className="text-primary" size={26} />
            </div>
          </Card.Body>
        </Card>
        <Card className="border-0 shadow-sm">
          <Card.Body>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <div className="text-xs uppercase text-muted">Latest backup</div>
                <div className="mt-2 small text-wrap">{formatDate(status?.latestBackupDate ?? latestBackup?.createdAt ?? null)}</div>
              </div>
              <HardDrive className="text-success" size={26} />
            </div>
          </Card.Body>
        </Card>
        <Card className="border-0 shadow-sm">
          <Card.Body>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <div className="text-xs uppercase text-muted">Latest validation</div>
                <div className={`mt-2 fw-semibold ${validationLabel === 'Passed' ? 'text-success' : validationLabel === 'Failed' ? 'text-danger' : 'text-secondary'}`}>{validationLabel}</div>
              </div>
              {validationLabel === 'Passed' ? <CheckCircle2 className="text-success" size={26} /> : <AlertTriangle className={validationLabel === 'Failed' ? 'text-danger' : 'text-warning'} size={26} />}
            </div>
          </Card.Body>
        </Card>
        <Card className="border-0 shadow-sm">
          <Card.Body>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <div className="text-xs uppercase text-muted">Local storage</div>
                <div className={`mt-2 fw-semibold ${status?.localStorageDirectoryExists && status.localStorageWritable ? 'text-success' : 'text-warning'}`}>
                  {!status?.localStorageConfigured ? 'Not configured' : !status.localStorageDirectoryExists ? 'Directory unavailable' : status.localStorageWritable ? 'Available and writable' : 'Not writable'}
                </div>
              </div>
              <HardDrive className="text-primary" size={26} />
            </div>
          </Card.Body>
        </Card>
        <Card className="border-0 shadow-sm">
          <Card.Body>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <div className="text-xs uppercase text-muted">Cloud status</div>
                <div className="mt-2 fw-semibold text-secondary">{status ? cloudStatusLabel : 'Not independently verified'}</div>
              </div>
              <Cloud className="text-secondary" size={26} />
            </div>
            <p className="mt-3 mb-0 small text-muted">
              A detected folder or SHA-256 matching local copy does not confirm cloud upload. Cloud sync is not independently verified.
            </p>
          </Card.Body>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white border-0">
          <h3 className="m-0 fs-5 fw-semibold">Backup history</h3>
        </Card.Header>
        <Card.Body className="p-0">
          {loading ? (
            <div className="d-flex justify-content-center p-5">
              <Spinner animation="border" />
            </div>
          ) : historyLoadError ? (
            <div className="p-5 text-center text-danger">Backup history could not be loaded. Use Refresh to try again.</div>
          ) : backups.length === 0 ? (
            <div className="p-5 text-center text-muted">No database backups have been created yet.</div>
          ) : (
            <Table responsive hover className="mb-0 align-middle">
              <thead>
                <tr>
                  <th>Backup ID</th>
                  <th>Filename</th>
                  <th>Created</th>
                  <th>Size</th>
                  <th>Validation</th>
                  <th>Local storage</th>
                  <th>Cloud synchronization</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr key={backup.id}>
                    <td>{backup.id}</td>
                    <td>{backup.filename ?? 'Not created'}</td>
                    <td>{formatDate(backup.createdAt)}</td>
                    <td>{formatSize(backup.sizeBytes)}</td>
                    <td>
                      {getBackupValidationLabel(backup) === 'Failed' ? (
                        <span className="badge text-bg-danger" title={backup.validationDetails}>Failed</span>
                      ) : getBackupValidationLabel(backup) === 'Passed' ? (
                        <span className="badge text-bg-success" title={backup.validationDetails}>Passed</span>
                      ) : (
                        <span className="badge text-bg-warning text-dark" title={backup.validationDetails}>Not verified</span>
                      )}
                      <div className="mt-1 small text-muted">{backup.validationDetails}</div>
                    </td>
                    <td>{backup.localStorageStatus === 'available' ? 'Local' : 'Unavailable'}</td>
                    <td>
                      {backup.cloudSynchronizationStatus === 'backup_copied_to_sync_folder'
                        ? 'SHA-256 local copy match; cloud unverified'
                        : backup.cloudSynchronizationStatus === 'local_sync_folder_detected'
                          ? 'Sync folder detected; no copy confirmed'
                          : backup.cloudSynchronizationStatus === 'configured_but_unavailable'
                            ? 'Configured folder unavailable'
                            : backup.cloudSynchronizationStatus === 'not_independently_verified'
                              ? 'Not independently verified'
                              : 'Not configured'}
                    </td>
                    <td>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => void handleDownload(backup.id)}
                        disabled={!backup.filename || backup.localStorageStatus !== 'available' || downloadingId !== null}
                      >
                        {downloadingId === backup.id ? <Spinner animation="border" size="sm" className="me-1" /> : <Download size={14} className="me-1" />}
                        {downloadingId === backup.id ? 'Downloading…' : 'Download'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default BackupRecovery;
