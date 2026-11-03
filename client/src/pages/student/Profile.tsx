import React, { useEffect, useState, useRef } from 'react';
import {
  User, Mail, Phone, GraduationCap, MapPin, Globe,
  Linkedin, Github, BookOpen, Edit3, Save, X, Camera,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { studentApi } from '../../services/api';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import type { StudentProfile } from '../../types';
import { getInitials, getAvatarUrl, getReadinessLabel, getReadinessColor } from '../../utils/helpers';
import { normalizeStudentProfileUpdate, type StudentProfileForm } from '../../utils/studentProfileUpdate.mjs';
import { getApiValidationFieldErrors } from '../../utils/apiValidationErrors.mjs';
import clsx from 'clsx';

export const Profile: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [form, setForm] = useState<StudentProfileForm>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    studentApi.getProfile().then(({ data }) => {
      setProfile(data.data);
      setForm(data.data);
    });
  }, []);

  const handleEdit = () => setIsEditing(true);
  const handleCancel = () => {
    setIsEditing(false);
    if (profile) setForm(profile);
  };

  const handleSave = async () => {
    let payload: ReturnType<typeof normalizeStudentProfileUpdate>;
    try {
      payload = normalizeStudentProfileUpdate(form);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Please check the profile fields.');
      return;
    }

    setIsSaving(true);
    try {
      const { data } = await studentApi.updateProfile(payload);
      setProfile(data.data);
      setForm(data.data);
      setIsEditing(false);
      refreshUser();
      toast.success('Profile updated successfully!');
    } catch (error: unknown) {
      const fieldErrors = getApiValidationFieldErrors(
        error,
        ['firstName', 'lastName', 'phone', 'university', 'faculty', 'degree', 'yearOfStudy', 'gpa', 'bio', 'linkedIn', 'github', 'portfolioUrl', 'city', 'country'],
      );
      setValidationErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) toast.error('Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB.');
      return;
    }
    setIsUploadingAvatar(true);
    try {
      const { data } = await studentApi.uploadAvatar(file);
      setProfile((p) => p ? { ...p, avatarUrl: data.data.avatarUrl } : p);
      refreshUser();
      toast.success('Avatar updated!');
    } catch {
      toast.error('Failed to upload avatar.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const set = (field: keyof StudentProfile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValidationErrors((errors) => {
      const next = { ...errors };
      delete next[field];
      return next;
    });
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  const readiness = profile?.readinessScore ?? 0;
  const avatarUrl = getAvatarUrl(profile?.avatarUrl);
  const initials = getInitials(profile?.firstName, profile?.lastName);

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const InputField: React.FC<{
    label: string;
    field: keyof StudentProfile;
    icon?: React.ElementType;
    type?: string;
    placeholder?: string;
  }> = ({ label, field, icon: Icon, type = 'text', placeholder }) => (
    <div>
      <label htmlFor={`profile-${field}`} className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {isEditing ? (
        <div className="relative">
          {Icon && <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />}
          <input
            id={`profile-${field}`}
            type={type}
            value={(form[field] as string) ?? ''}
            onChange={set(field)}
            placeholder={placeholder}
            className={clsx(
              'w-full py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500',
              Icon ? 'pl-9 pr-3' : 'px-3',
            )}
            aria-invalid={Boolean(validationErrors[field])}
            aria-describedby={validationErrors[field] ? `${field}-error` : undefined}
          />
        </div>
      ) : (
        <p className="text-sm text-gray-800">
          {(profile[field] as string) || <span className="text-gray-400 italic">Not set</span>}
        </p>
      )}
      {validationErrors[field] && (
        <p id={`${field}-error`} className="mt-1 text-xs text-red-600" role="alert">
          {validationErrors[field]}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Profile Header Card */}
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Avatar */}
          <div className="relative group">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center overflow-hidden shadow-lg">
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-2xl font-bold">{initials}</span>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
            >
              {isUploadingAvatar ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera size={18} className="text-white" />
              )}
            </button>
            <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
          </div>

          {/* Info */}
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">
              {profile.firstName} {profile.lastName}
            </h2>
            <p className="text-gray-500 text-sm mt-0.5">{profile.degree ?? 'Student'}</p>
            {profile.university && (
              <p className="flex items-center gap-1 text-sm text-gray-400 mt-1">
                <GraduationCap size={14} /> {profile.university}
              </p>
            )}
          </div>

          {/* Readiness Widget */}
          <div className="text-center bg-gray-50 rounded-xl px-6 py-4 min-w-[140px]">
            <p className="text-xs text-gray-500 mb-2">Readiness Score</p>
            <p className={clsx('text-3xl font-bold', getReadinessColor(readiness))}>{readiness}%</p>
            <p className={clsx('text-xs font-medium mt-1', getReadinessColor(readiness))}>
              {getReadinessLabel(readiness)}
            </p>
            <ProgressBar value={readiness} size="sm" className="mt-2" />
          </div>

          {/* Edit button */}
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="ghost" size="sm" onClick={handleCancel} leftIcon={<X size={14} />}>Cancel</Button>
                <Button size="sm" onClick={handleSave} isLoading={isSaving} leftIcon={<Save size={14} />}>Save</Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={handleEdit} leftIcon={<Edit3 size={14} />}>Edit Profile</Button>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Information */}
        <Card>
          <CardTitle className="mb-5">Personal Information</CardTitle>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InputField label="First Name" field="firstName" icon={User} placeholder="Alex" />
              <InputField label="Last Name" field="lastName" icon={User} placeholder="Johnson" />
            </div>
            <InputField label="Phone" field="phone" icon={Phone} placeholder="+27 71 234 5678" />
            <InputField label="City" field="city" icon={MapPin} placeholder="Cape Town" />
            <InputField label="Country" field="country" placeholder="South Africa" />
          </div>
        </Card>

        {/* Academic Information */}
        <Card>
          <CardTitle className="mb-5">Academic Information</CardTitle>
          <div className="space-y-4">
            <InputField label="University" field="university" icon={GraduationCap} placeholder="Richfield Graduate Institute" />
            <InputField label="Faculty" field="faculty" placeholder="Faculty of IT" />
            <InputField label="Degree" field="degree" icon={BookOpen} placeholder="BSc Information Technology" />
            <div className="grid grid-cols-2 gap-4">
              <InputField label="Year of Study" field="yearOfStudy" type="number" placeholder="3" />
              <InputField label="GPA" field="gpa" type="number" placeholder="3.5" />
            </div>
          </div>
        </Card>

        {/* Bio */}
        <Card>
          <CardTitle className="mb-5">About Me</CardTitle>
          <div>
            <label htmlFor="profile-bio" className="block text-xs font-medium text-gray-500 mb-1">Bio</label>
            {isEditing ? (
              <>
                <textarea
                  id="profile-bio"
                  value={(form.bio as string) ?? ''}
                  onChange={set('bio')}
                  aria-invalid={Boolean(validationErrors.bio)}
                  aria-describedby={validationErrors.bio ? 'bio-error' : undefined}
                  rows={5}
                  placeholder="Tell employers about yourself..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
                {validationErrors.bio && <p id="bio-error" className="mt-1 text-xs text-red-600" role="alert">{validationErrors.bio}</p>}
              </>
            ) : (
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {profile.bio || <span className="text-gray-400 italic">No bio added yet.</span>}
              </p>
            )}
          </div>
        </Card>

        {/* Online Presence */}
        <Card>
          <CardTitle className="mb-5">Online Presence</CardTitle>
          <div className="space-y-4">
            <InputField label="LinkedIn" field="linkedIn" icon={Linkedin} placeholder="https://linkedin.com/in/yourname" />
            <InputField label="GitHub" field="github" icon={Github} placeholder="https://github.com/yourname" />
            <InputField label="Portfolio URL" field="portfolioUrl" icon={Globe} placeholder="https://yourportfolio.com" />
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
