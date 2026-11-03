import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { employerApi, skillsApi } from '../../services/api';
import type { Skill, CreateInternshipSkill, ProficiencyLevel, InternshipStatus } from '../../types';
import { Card, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { PROFICIENCY_LABELS } from '../../utils/helpers';
import { getApiValidationFieldErrors } from '../../utils/apiValidationErrors.mjs';

const INDUSTRIES = ['Technology', 'Finance', 'Healthcare', 'Education', 'Marketing', 'Design', 'Engineering', 'Other'];
const PROFICIENCY_OPTIONS: ProficiencyLevel[] = ['BEGINNER', 'ELEMENTARY', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];

const PostInternship: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const [skills, setSkills] = useState<Skill[]>([]);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    title: '',
    description: '',
    responsibilities: '',
    requirements: '',
    location: '',
    isRemote: false,
    stipend: '',
    currency: 'ZAR',
    durationMonths: '',
    startDate: '',
    applicationDeadline: '',
    status: 'ACTIVE' as InternshipStatus,
    industry: '',
    tags: '',
  });
  const [internshipSkills, setInternshipSkills] = useState<
    Array<CreateInternshipSkill & { skillName: string }>
  >([]);
  const [addingSkill, setAddingSkill] = useState({ skillId: '', importance: 3, minimumLevel: 'INTERMEDIATE' as ProficiencyLevel });
  const updateForm = (updater: (current: typeof form) => typeof form) => {
    setValidationErrors({});
    setForm(updater);
  };

  useEffect(() => {
    skillsApi.getAll().then((r) => setSkills(r.data.data));
    if (isEdit && id) {
      // Load existing data for editing
      employerApi.getMyInternship(id).then(({ data }) => {
        const found = data.data;
        setForm({
          title: found.title,
          description: found.description,
          responsibilities: found.responsibilities ?? '',
          requirements: found.requirements ?? '',
          location: found.location ?? '',
          isRemote: found.isRemote,
          stipend: found.stipend ? String(found.stipend) : '',
          currency: found.currency,
          durationMonths: found.durationMonths ? String(found.durationMonths) : '',
          startDate: found.startDate ? found.startDate.split('T')[0] : '',
          applicationDeadline: found.applicationDeadline ? found.applicationDeadline.split('T')[0] : '',
          status: found.status,
          industry: found.industry ?? '',
          tags: found.tags ?? '',
        });
        setInternshipSkills(
          found.requiredSkills.map((rs) => ({
            skillId: rs.skillId,
            importance: rs.importance,
            minimumLevel: rs.minimumLevel as ProficiencyLevel,
            skillName: rs.skill.name,
          }))
        );
      });
    }
  }, [id, isEdit]);

  const handleAddSkill = () => {
    if (!addingSkill.skillId) return;
    const skill = skills.find((s) => s.id === addingSkill.skillId);
    if (!skill) return;
    if (internshipSkills.find((s) => s.skillId === addingSkill.skillId)) {
      toast.error('Skill already added.');
      return;
    }
    setValidationErrors({});
    setInternshipSkills((prev) => [...prev, { ...addingSkill, skillName: skill.name }]);
    setAddingSkill({ skillId: '', importance: 3, minimumLevel: 'INTERMEDIATE' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) { toast.error('Internship title is required.'); return; }
    if (!form.description) { toast.error('Description is required.'); return; }
    if (!form.durationMonths) { toast.error('Duration is required.'); return; }
    if (!form.location && !form.isRemote) { toast.error('Location is required (or mark as Remote).'); return; }
    if (!form.applicationDeadline) { toast.error('Closing date is required.'); return; }
    if (internshipSkills.length === 0) {
      setValidationErrors({ skills: 'At least one required skill must be added.' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        stipend: form.stipend ? Number(form.stipend) : undefined,
        durationMonths: form.durationMonths ? Number(form.durationMonths) : undefined,
        startDate: form.startDate || undefined,
        applicationDeadline: form.applicationDeadline || undefined,
        skills: internshipSkills.map(({ skillId, importance, minimumLevel }) => ({ skillId, importance, minimumLevel })),
      };
      if (isEdit && id) {
        await employerApi.updateInternship(id, payload);
        toast.success('Internship updated!');
      } else {
        await employerApi.createInternship(payload);
        toast.success('Internship posted!');
      }
      navigate('/employer/internships');
    } catch (error: unknown) {
      const fieldErrors = getApiValidationFieldErrors(
        error,
        ['title', 'description', 'responsibilities', 'requirements', 'location', 'stipend', 'currency', 'durationMonths', 'startDate', 'applicationDeadline', 'status', 'industry', 'tags', 'skills'],
      );
      setValidationErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) toast.error('Failed to save internship.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';
  const labelClass = 'block text-xs font-medium text-gray-600 mb-1';

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <h2 className="text-xl font-bold text-gray-900">{isEdit ? 'Edit Internship' : 'Post New Internship'}</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic Info */}
        <Card>
          <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
          <div className="px-5 pb-5 grid grid-cols-1 gap-4">
            <div>
              <label className={labelClass}>Title *</label>
              <input className={inputClass} value={form.title} onChange={(e) => updateForm((f) => ({ ...f, title: e.target.value }))} aria-invalid={Boolean(validationErrors.title)} aria-describedby={validationErrors.title ? 'title-error' : undefined} placeholder="e.g. Frontend Developer Intern" />
              {validationErrors.title && <p id="title-error" className="mt-1 text-xs text-red-600" role="alert">{validationErrors.title}</p>}
            </div>
            <div>
              <label className={labelClass}>Description *</label>
              <textarea rows={4} className={inputClass + ' resize-none'} value={form.description} onChange={(e) => updateForm((f) => ({ ...f, description: e.target.value }))} aria-invalid={Boolean(validationErrors.description)} aria-describedby={validationErrors.description ? 'description-error' : undefined} placeholder="Describe the role..." />
              {validationErrors.description && <p id="description-error" className="mt-1 text-xs text-red-600" role="alert">{validationErrors.description}</p>}
            </div>
            <div>
              <label className={labelClass}>Responsibilities</label>
              <textarea rows={3} className={inputClass + ' resize-none'} value={form.responsibilities} onChange={(e) => updateForm((f) => ({ ...f, responsibilities: e.target.value }))} aria-invalid={Boolean(validationErrors.responsibilities)} aria-describedby={validationErrors.responsibilities ? 'responsibilities-error' : undefined} placeholder="Key responsibilities..." />
              {validationErrors.responsibilities && <p id="responsibilities-error" className="mt-1 text-xs text-red-600" role="alert">{validationErrors.responsibilities}</p>}
            </div>
            <div>
              <label className={labelClass}>Requirements</label>
              <textarea rows={3} className={inputClass + ' resize-none'} value={form.requirements} onChange={(e) => updateForm((f) => ({ ...f, requirements: e.target.value }))} aria-invalid={Boolean(validationErrors.requirements)} aria-describedby={validationErrors.requirements ? 'requirements-error' : undefined} placeholder="Minimum requirements..." />
              {validationErrors.requirements && <p id="requirements-error" className="mt-1 text-xs text-red-600" role="alert">{validationErrors.requirements}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Industry</label>
                <select className={inputClass} value={form.industry} onChange={(e) => updateForm((f) => ({ ...f, industry: e.target.value }))} aria-invalid={Boolean(validationErrors.industry)} aria-describedby={validationErrors.industry ? 'industry-error' : undefined}>
                  <option value="">Select industry</option>
                  {INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
                </select>
                {validationErrors.industry && <p id="industry-error" className="mt-1 text-xs text-red-600" role="alert">{validationErrors.industry}</p>}
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select className={inputClass} value={form.status} onChange={(e) => updateForm((f) => ({ ...f, status: e.target.value as InternshipStatus }))} aria-invalid={Boolean(validationErrors.status)} aria-describedby={validationErrors.status ? 'status-error' : undefined}>
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="CLOSED">Closed</option>
                </select>
                {validationErrors.status && <p id="status-error" className="mt-1 text-xs text-red-600" role="alert">{validationErrors.status}</p>}
              </div>
            </div>
          </div>
        </Card>

        {/* Location & Compensation */}
        <Card>
          <CardHeader><CardTitle>Location & Compensation</CardTitle></CardHeader>
          <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Location <span className="text-red-500">*</span> <span className="text-gray-400 font-normal">(or mark Remote below)</span></label>
              <input className={inputClass} value={form.location} onChange={(e) => updateForm((f) => ({ ...f, location: e.target.value }))} aria-invalid={Boolean(validationErrors.location)} aria-describedby={validationErrors.location ? 'location-error' : undefined} placeholder="City, Province" />
              {validationErrors.location && <p id="location-error" className="mt-1 text-xs text-red-600" role="alert">{validationErrors.location}</p>}
            </div>
            <div className="flex items-center gap-3 pt-5">
              <input type="checkbox" id="remote" checked={form.isRemote} onChange={(e) => updateForm((f) => ({ ...f, isRemote: e.target.checked }))} className="w-4 h-4 text-emerald-600 rounded" />
              <label htmlFor="remote" className="text-sm text-gray-700">Remote / Hybrid</label>
            </div>
            <div>
              <label className={labelClass}>Monthly Stipend</label>
              <input type="number" className={inputClass} value={form.stipend} onChange={(e) => updateForm((f) => ({ ...f, stipend: e.target.value }))} aria-invalid={Boolean(validationErrors.stipend)} aria-describedby={validationErrors.stipend ? 'stipend-error' : undefined} placeholder="e.g. 5000" />
              {validationErrors.stipend && <p id="stipend-error" className="mt-1 text-xs text-red-600" role="alert">{validationErrors.stipend}</p>}
            </div>
            <div>
              <label className={labelClass}>Currency</label>
              <select className={inputClass} value={form.currency} onChange={(e) => updateForm((f) => ({ ...f, currency: e.target.value }))} aria-invalid={Boolean(validationErrors.currency)} aria-describedby={validationErrors.currency ? 'currency-error' : undefined}>
                <option value="ZAR">ZAR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
              {validationErrors.currency && <p id="currency-error" className="mt-1 text-xs text-red-600" role="alert">{validationErrors.currency}</p>}
            </div>
            <div>
              <label className={labelClass}>Duration (months) <span className="text-red-500">*</span></label>
              <input type="number" className={inputClass} value={form.durationMonths} onChange={(e) => updateForm((f) => ({ ...f, durationMonths: e.target.value }))} aria-invalid={Boolean(validationErrors.durationMonths)} aria-describedby={validationErrors.durationMonths ? 'durationMonths-error' : undefined} placeholder="e.g. 6" />
              {validationErrors.durationMonths && <p id="durationMonths-error" className="mt-1 text-xs text-red-600" role="alert">{validationErrors.durationMonths}</p>}
            </div>
          </div>
        </Card>

        {/* Dates */}
        <Card>
          <CardHeader><CardTitle>Dates</CardTitle></CardHeader>
          <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Start Date</label>
              <input type="date" className={inputClass} value={form.startDate} onChange={(e) => updateForm((f) => ({ ...f, startDate: e.target.value }))} aria-invalid={Boolean(validationErrors.startDate)} aria-describedby={validationErrors.startDate ? 'startDate-error' : undefined} />
              {validationErrors.startDate && <p id="startDate-error" className="mt-1 text-xs text-red-600" role="alert">{validationErrors.startDate}</p>}
            </div>
            <div>
              <label className={labelClass}>Application Deadline <span className="text-red-500">*</span></label>
              <input type="date" className={inputClass} value={form.applicationDeadline} onChange={(e) => updateForm((f) => ({ ...f, applicationDeadline: e.target.value }))} aria-invalid={Boolean(validationErrors.applicationDeadline)} aria-describedby={validationErrors.applicationDeadline ? 'applicationDeadline-error' : undefined} />
              {validationErrors.applicationDeadline && <p id="applicationDeadline-error" className="mt-1 text-xs text-red-600" role="alert">{validationErrors.applicationDeadline}</p>}
            </div>
          </div>
        </Card>

        {/* Required Skills */}
        <Card>
          <CardHeader><CardTitle>Required Skills <span className="text-red-500">*</span></CardTitle></CardHeader>
          <div className="px-5 pb-5 space-y-3">
            {validationErrors.skills && <p className="text-xs text-red-600" role="alert">{validationErrors.skills}</p>}
            {internshipSkills.length > 0 && (
              <div className="space-y-2">
                {internshipSkills.map((s) => (
                  <div key={s.skillId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{s.skillName}</p>
                      <p className="text-xs text-gray-500">
                        Min level: {PROFICIENCY_LABELS[s.minimumLevel]} · Importance: {s.importance}/5
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setValidationErrors({});
                        setInternshipSkills((prev) => prev.filter((x) => x.skillId !== s.skillId));
                      }}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add skill row */}
            <div className="flex gap-2 flex-wrap">
              <select
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-32"
                value={addingSkill.skillId}
                onChange={(e) => setAddingSkill((s) => ({ ...s, skillId: e.target.value }))}
              >
                <option value="">Select skill</option>
                {skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={addingSkill.minimumLevel}
                onChange={(e) => setAddingSkill((s) => ({ ...s, minimumLevel: e.target.value as ProficiencyLevel }))}
              >
                {PROFICIENCY_OPTIONS.map((l) => <option key={l} value={l}>{PROFICIENCY_LABELS[l]}</option>)}
              </select>
              <select
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={addingSkill.importance}
                onChange={(e) => setAddingSkill((s) => ({ ...s, importance: Number(e.target.value) }))}
              >
                {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v === 5 ? '5 (Required)' : v === 1 ? '1 (Nice-to-have)' : `${v}`}</option>)}
              </select>
              <Button type="button" variant="secondary" size="sm" leftIcon={<Plus size={14} />} onClick={handleAddSkill}>Add</Button>
            </div>
          </div>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" isLoading={saving}>{isEdit ? 'Save Changes' : 'Post Internship'}</Button>
        </div>
      </form>
    </div>
  );
};

export default PostInternship;
