import React, { useEffect, useState, useRef } from 'react';
import { Building2, Globe, MapPin, Pencil, Camera, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { employerApi } from '../../services/api';
import type { EmployerProfile } from '../../types';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { getAvatarUrl } from '../../utils/helpers';
import { getApiValidationFieldErrors } from '../../utils/apiValidationErrors.mjs';
import { normalizeEmployerProfileUpdate } from '../../utils/employerProfileUpdate.mjs';

const CompanyProfile: React.FC = () => {
  const [profile, setProfile] = useState<EmployerProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [logoUploading, setLogoUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    companyName: '', industry: '', website: '', description: '', city: '', country: '',
  });

  useEffect(() => {
    employerApi.getProfile()
      .then((r) => {
        const p = r.data.data;
        setProfile(p);
        setForm({
          companyName: p.companyName,
          industry: p.industry ?? '',
          website: p.website ?? '',
          description: p.description ?? '',
          city: p.city ?? '',
          country: p.country,
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await employerApi.updateProfile(normalizeEmployerProfileUpdate(form));
      setProfile(r.data.data);
      setEditing(false);
      toast.success('Profile updated!');
    } catch (error: unknown) {
      const fieldErrors = getApiValidationFieldErrors(
        error,
        ['companyName', 'industry', 'website', 'description', 'city', 'country'],
      );
      setValidationErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) toast.error('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const r = await employerApi.uploadLogo(file);
      setProfile((p) => p ? { ...p, logoUrl: r.data.data.logoUrl } : p);
      toast.success('Logo updated!');
    } catch {
      toast.error('Failed to upload logo.');
    } finally {
      setLogoUploading(false);
    }
  };

  if (loading) return <div className="h-64 bg-gray-100 animate-pulse rounded-xl" />;

  const logoUrl = getAvatarUrl(profile?.logoUrl);
  const initials = profile?.companyName?.slice(0, 2).toUpperCase() ?? 'CO';

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle>Company Profile</CardTitle>
          {!editing && (
            <Button variant="secondary" size="sm" leftIcon={<Pencil size={14} />} onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </CardHeader>

        {/* Logo */}
        <div className="px-6 pb-4 flex items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-emerald-100 flex items-center justify-center overflow-hidden ring-4 ring-white shadow">
              {logoUrl ? (
                <img src={logoUrl} alt="logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-emerald-700 text-2xl font-bold">{initials}</span>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={logoUploading}
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-600 rounded-full flex items-center justify-center text-white shadow hover:bg-emerald-700 transition-colors"
            >
              <Camera size={13} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{profile?.companyName}</p>
            {profile?.industry && <p className="text-sm text-gray-500">{profile.industry}</p>}
          </div>
        </div>

        {/* Fields */}
        <div className="px-6 pb-6 grid grid-cols-1 gap-4">
          {([
            { key: 'companyName', label: 'Company Name', icon: Building2 },
            { key: 'industry',    label: 'Industry',      icon: Building2 },
            { key: 'website',     label: 'Website',       icon: Globe },
            { key: 'city',        label: 'City',          icon: MapPin },
            { key: 'country',     label: 'Country',       icon: MapPin },
          ] as Array<{ key: keyof typeof form; label: string; icon: React.ElementType }>).map(({ key, label, icon: Icon }) => (
            <div key={key}>
              <label htmlFor={`company-${key}`} className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-1">
                <Icon size={12} /> {label}
              </label>
              {editing ? (
                <>
                  <input
                    id={`company-${key}`}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={form[key]}
                    onChange={(e) => {
                      setValidationErrors((errors) => {
                        const next = { ...errors };
                        delete next[key];
                        return next;
                      });
                      setForm((f) => ({ ...f, [key]: e.target.value }));
                    }}
                    aria-invalid={Boolean(validationErrors[key])}
                    aria-describedby={validationErrors[key] ? `company-${key}-error` : undefined}
                  />
                  {validationErrors[key] && <p id={`company-${key}-error`} className="mt-1 text-xs text-red-600" role="alert">{validationErrors[key]}</p>}
                </>
              ) : (
                <p className="text-sm text-gray-900">{profile?.[key] || <span className="text-gray-400">Not set</span>}</p>
              )}
            </div>
          ))}

          {/* Description */}
          <div>
            <label htmlFor="company-description" className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">About the Company</label>
            {editing ? (
              <>
                <textarea
                  id="company-description"
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  value={form.description}
                  onChange={(e) => {
                    setValidationErrors((errors) => {
                      const next = { ...errors };
                      delete next.description;
                      return next;
                    });
                    setForm((f) => ({ ...f, description: e.target.value }));
                  }}
                  aria-invalid={Boolean(validationErrors.description)}
                  aria-describedby={validationErrors.description ? 'company-description-error' : undefined}
                />
                {validationErrors.description && <p id="company-description-error" className="mt-1 text-xs text-red-600" role="alert">{validationErrors.description}</p>}
              </>
            ) : (
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{profile?.description || <span className="text-gray-400">No description yet</span>}</p>
            )}
          </div>

          {editing && (
            <div className="flex gap-3 pt-2">
              <Button onClick={handleSave} isLoading={saving} leftIcon={<Check size={14} />}>Save Changes</Button>
              <Button variant="ghost" leftIcon={<X size={14} />} onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default CompanyProfile;
