import React, { useEffect, useState } from 'react';
import { Plus, Trash2, ChevronDown, Search, Award } from 'lucide-react';
import toast from 'react-hot-toast';
import { skillsApi } from '../../services/api';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ProgressBar } from '../../components/ui/ProgressBar';
import type { Skill, StudentSkill, ProficiencyLevel, SkillCategory } from '../../types';
import {
  PROFICIENCY_LABELS, PROFICIENCY_SCORES, PROFICIENCY_COLORS,
  SKILL_CATEGORY_LABELS, SKILL_CATEGORY_COLORS,
} from '../../utils/helpers';
import clsx from 'clsx';

const PROFICIENCY_LEVELS: ProficiencyLevel[] = ['BEGINNER', 'ELEMENTARY', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];

export const Skills: React.FC = () => {
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [mySkills, setMySkills] = useState<StudentSkill[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Add skill form
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [proficiency, setProficiency] = useState<ProficiencyLevel>('BEGINNER');
  const [yearsExp, setYearsExp] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProficiency, setEditProficiency] = useState<ProficiencyLevel>('BEGINNER');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    Promise.all([skillsApi.getAll(), skillsApi.getMySkills()]).then(([allRes, myRes]) => {
      setAllSkills(allRes.data.data);
      setMySkills(myRes.data.data);
    }).finally(() => setIsLoading(false));
  }, []);

  const ownedSkillIds = new Set(mySkills.map((s) => s.skillId));
  const availableSkills = allSkills.filter((s) => !ownedSkillIds.has(s.id));

  const categories = ['ALL', ...Array.from(new Set(mySkills.map((s) => s.skill.category)))];

  const filteredMySkills = mySkills
    .filter((s) => selectedCategory === 'ALL' || s.skill.category === selectedCategory)
    .filter((s) => s.skill.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleAddSkill = async () => {
    if (!selectedSkillId) { toast.error('Please select a skill.'); return; }
    setIsAdding(true);
    try {
      const { data } = await skillsApi.addSkill(selectedSkillId, proficiency, yearsExp ? Number(yearsExp) : undefined);
      setMySkills((prev) => [...prev, data.data]);
      setIsAddOpen(false);
      setSelectedSkillId('');
      setProficiency('BEGINNER');
      setYearsExp('');
      toast.success('Skill added!');
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to add skill.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this skill from your profile?')) return;
    try {
      await skillsApi.removeSkill(id);
      setMySkills((prev) => prev.filter((s) => s.id !== id));
      toast.success('Skill removed.');
    } catch {
      toast.error('Failed to remove skill.');
    }
  };

  const startEdit = (skill: StudentSkill) => {
    setEditingId(skill.id);
    setEditProficiency(skill.proficiency);
  };

  const handleSaveEdit = async (id: string) => {
    setIsSaving(true);
    try {
      const { data } = await skillsApi.updateSkill(id, { proficiency: editProficiency });
      setMySkills((prev) => prev.map((s) => s.id === id ? data.data : s));
      setEditingId(null);
      toast.success('Skill updated!');
    } catch {
      toast.error('Failed to update skill.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">My Skills</h2>
          <p className="text-sm text-gray-500 mt-0.5">{mySkills.length} skills in your profile</p>
        </div>
        <Button leftIcon={<Plus size={16} />} onClick={() => setIsAddOpen(true)}>
          Add Skill
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {PROFICIENCY_LEVELS.map((level) => {
          const count = mySkills.filter((s) => s.proficiency === level).length;
          return (
            <div key={level} className="bg-white rounded-xl border border-gray-100 p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-800">{count}</p>
              <p className={clsx('text-xs font-medium mt-0.5', PROFICIENCY_COLORS[level].split(' ')[1])}>{PROFICIENCY_LABELS[level]}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search skills..."
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                selectedCategory === cat
                  ? 'bg-primary-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-300',
              )}
            >
              {cat === 'ALL' ? 'All Categories' : SKILL_CATEGORY_LABELS[cat as SkillCategory]}
            </button>
          ))}
        </div>
      </div>

      {/* Skills Grid */}
      {filteredMySkills.length === 0 ? (
        <Card className="text-center py-12">
          <Award size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-600 font-medium">No skills yet</p>
          <p className="text-sm text-gray-400 mt-1">Add skills to see your internship match scores.</p>
          <Button className="mt-4" onClick={() => setIsAddOpen(true)}>Add Your First Skill</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMySkills.map((ss) => {
            const isEdit = editingId === ss.id;
            const profScore = PROFICIENCY_SCORES[isEdit ? editProficiency : ss.proficiency];
            return (
              <Card key={ss.id} className="group">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900">{ss.skill.name}</p>
                    <Badge className={clsx('mt-1', SKILL_CATEGORY_COLORS[ss.skill.category])} size="sm">
                      {SKILL_CATEGORY_LABELS[ss.skill.category]}
                    </Badge>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!isEdit && (
                      <button onClick={() => startEdit(ss)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 text-xs">
                        Edit
                      </button>
                    )}
                    <button onClick={() => handleRemove(ss.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {isEdit ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {PROFICIENCY_LEVELS.map((lvl) => (
                        <button
                          key={lvl}
                          onClick={() => setEditProficiency(lvl)}
                          className={clsx(
                            'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                            editProficiency === lvl ? PROFICIENCY_COLORS[lvl] : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                          )}
                        >
                          {PROFICIENCY_LABELS[lvl]}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSaveEdit(ss.id)} isLoading={isSaving}>Save</Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={PROFICIENCY_COLORS[ss.proficiency]} size="sm">
                        {PROFICIENCY_LABELS[ss.proficiency]}
                      </Badge>
                      {ss.yearsExperience && (
                        <span className="text-xs text-gray-400">{ss.yearsExperience}y exp</span>
                      )}
                    </div>
                    <ProgressBar value={profScore} max={5} size="sm" />
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Skill Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add a New Skill"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddSkill} isLoading={isAdding}>Add Skill</Button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Skill</label>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select
                value={selectedSkillId}
                onChange={(e) => setSelectedSkillId(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none"
              >
                <option value="">-- Choose a skill --</option>
                {Object.entries(
                  availableSkills.reduce<Record<string, Skill[]>>((acc, s) => {
                    const cat = SKILL_CATEGORY_LABELS[s.category];
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(s);
                    return acc;
                  }, {})
                ).map(([cat, catSkills]) => (
                  <optgroup key={cat} label={cat}>
                    {catSkills.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Proficiency Level</label>
            <div className="grid grid-cols-5 gap-2">
              {PROFICIENCY_LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setProficiency(lvl)}
                  className={clsx(
                    'py-2 px-1 rounded-lg text-xs font-medium text-center transition-all border',
                    proficiency === lvl
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-500',
                  )}
                >
                  {PROFICIENCY_LABELS[lvl]}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <ProgressBar value={PROFICIENCY_SCORES[proficiency]} max={5} size="md" showLabel />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Years of Experience (optional)</label>
            <input
              type="number"
              min="0"
              max="20"
              step="0.5"
              value={yearsExp}
              onChange={(e) => setYearsExp(e.target.value)}
              placeholder="e.g. 1.5"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Skills;
