import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Award, Search, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../services/api';
import type { AdminSkill, SkillCategory } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { SKILL_CATEGORY_LABELS, SKILL_CATEGORY_COLORS } from '../../utils/helpers';
import { getApiValidationFieldErrors } from '../../utils/apiValidationErrors.mjs';

const CATEGORIES: SkillCategory[] = ['PROGRAMMING','FRAMEWORK','DATABASE','CLOUD','DEVOPS','DESIGN','SOFT_SKILL','LANGUAGE','TOOL','OTHER'];

const SkillsCatalogue: React.FC = () => {
  const [skills, setSkills] = useState<AdminSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', category: '', description: '' });
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', category: 'OTHER', description: '' });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addNameError, setAddNameError] = useState('');
  const [editNameError, setEditNameError] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const r = await adminApi.getSkills({ search: search || undefined, category: categoryFilter || undefined });
      setSkills(r.data.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search, categoryFilter]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name) return;
    setSaving(true);
    try {
      const r = await adminApi.createSkill(addForm);
      toast.success('Skill added!');
      setShowAdd(false);
      setAddForm({ name: '', category: 'OTHER', description: '' });
      load();
    } catch (error: unknown) {
      const fieldErrors = getApiValidationFieldErrors(error, ['name']);
      setAddNameError(fieldErrors.name ?? '');
      if (!fieldErrors.name) toast.error('Failed to add skill.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditSave = async (id: string) => {
    const name = editForm.name.trim();
    if (!name) {
      toast.error('Skill name cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      await adminApi.updateSkill(id, { ...editForm, name });
      toast.success('Skill updated!');
      setEditingId(null);
      load();
    } catch (error: unknown) {
      const fieldErrors = getApiValidationFieldErrors(error, ['name']);
      setEditNameError(fieldErrors.name ?? '');
      if (!fieldErrors.name) toast.error('Failed to update skill.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete skill "${name}"? It will be removed from all students and internships.`)) return;
    setDeletingId(id);
    try {
      await adminApi.deleteSkill(id);
      toast.success('Skill deleted.');
      setSkills((prev) => prev.filter((s) => s.id !== id));
    } catch {
      toast.error('Failed to delete skill.');
    } finally {
      setDeletingId(null);
    }
  };

  const inputClass = 'border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500';

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Skills Catalogue</h2>
          <p className="text-sm text-gray-500">{skills.length} skills</p>
        </div>
        <Button leftIcon={<Plus size={16} />} onClick={() => setShowAdd(true)}>Add Skill</Button>
      </div>

      {/* Add form */}
      {showAdd && (
        <Card className="p-4 border-2 border-violet-200 bg-violet-50">
          <form onSubmit={handleAdd} className="flex gap-3 flex-wrap items-end">
            <div>
              <label htmlFor="new-skill-name" className="text-xs font-medium text-gray-600 mb-1 block">Name *</label>
              <input id="new-skill-name" className={inputClass} value={addForm.name} onChange={(e) => { setAddNameError(''); setAddForm((f) => ({ ...f, name: e.target.value })); }} aria-invalid={Boolean(addNameError)} aria-describedby={addNameError ? 'new-skill-name-error' : undefined} placeholder="Skill name" required />
              {addNameError && <p id="new-skill-name-error" className="mt-1 text-xs text-red-600" role="alert">{addNameError}</p>}
            </div>
            <div>
              <label htmlFor="new-skill-category" className="text-xs font-medium text-gray-600 mb-1 block">Category</label>
              <select id="new-skill-category" className={inputClass} value={addForm.category} onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{SKILL_CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-40">
              <label htmlFor="new-skill-description" className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
              <input id="new-skill-description" className={inputClass + ' w-full'} value={addForm.description} onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
            </div>
            <Button type="submit" size="sm" isLoading={saving} leftIcon={<Check size={14} />}>Add</Button>
            <Button type="button" size="sm" variant="ghost" leftIcon={<X size={14} />} onClick={() => setShowAdd(false)}>Cancel</Button>
          </form>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            aria-label="Search skills"
            placeholder="Search skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          aria-label="Filter skills by category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{SKILL_CATEGORY_LABELS[c]}</option>)}
        </select>
      </div>

      <Card>
        {loadError ? (
          <div className="p-8 text-center" role="alert">
            <p className="text-sm text-red-700">Skills could not be loaded. Please try again.</p>
            <Button className="mt-3" size="sm" variant="outline" onClick={() => { void load(); }}>
              Retry
            </Button>
          </div>
        ) : loading ? (
          <div className="p-8 space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}</div>
        ) : skills.length === 0 ? (
          <div className="p-12 text-center"><Award size={32} className="mx-auto text-gray-300 mb-3" /><p className="text-gray-500">No skills found.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Students</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Internships</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {skills.map((skill) => (
                  <tr key={skill.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {editingId === skill.id ? (
                        <div>
                          <input aria-label={`Skill name for ${skill.name}`} className={inputClass} value={editForm.name} onChange={(e) => { setEditNameError(''); setEditForm((f) => ({ ...f, name: e.target.value })); }} aria-invalid={Boolean(editNameError)} aria-describedby={editNameError ? `edit-skill-name-error-${skill.id}` : undefined} />
                          {editNameError && <p id={`edit-skill-name-error-${skill.id}`} className="mt-1 text-xs text-red-600" role="alert">{editNameError}</p>}
                        </div>
                      ) : (
                        <p className="font-medium text-gray-900">{skill.name}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === skill.id ? (
                        <select aria-label={`Category for ${skill.name}`} className={inputClass} value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}>
                          {CATEGORIES.map((c) => <option key={c} value={c}>{SKILL_CATEGORY_LABELS[c]}</option>)}
                        </select>
                      ) : (
                        <Badge variant={SKILL_CATEGORY_COLORS[skill.category as SkillCategory] as 'default' | 'info' | 'success' | 'warning' | 'danger'} size="sm">
                          {SKILL_CATEGORY_LABELS[skill.category as SkillCategory] ?? skill.category}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{skill._count.studentSkills}</td>
                    <td className="px-4 py-3 text-gray-600">{skill._count.internshipSkills}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {editingId === skill.id ? (
                          <>
                            <button onClick={() => handleEditSave(skill.id)} className="text-green-500 hover:text-green-700 p-1" aria-label={`Save skill ${skill.name}`}><Check size={14} /></button>
                            <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600 p-1" aria-label={`Cancel editing ${skill.name}`}><X size={14} /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditingId(skill.id); setEditNameError(''); setEditForm({ name: skill.name, category: skill.category, description: skill.description ?? '' }); }} className="text-gray-400 hover:text-violet-600 p-1" aria-label={`Edit skill ${skill.name}`}><Pencil size={14} /></button>
                            <button onClick={() => handleDelete(skill.id, skill.name)} disabled={deletingId === skill.id} className="text-red-400 hover:text-red-600 p-1" aria-label={`Delete skill ${skill.name}`}><Trash2 size={14} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default SkillsCatalogue;
