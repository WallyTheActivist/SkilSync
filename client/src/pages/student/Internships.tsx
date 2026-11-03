import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, Wifi, Clock, DollarSign, Filter, Briefcase } from 'lucide-react';
import { internshipsApi } from '../../services/api';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import type { Internship } from '../../types';
import { formatCurrency, formatDate, truncate } from '../../utils/helpers';
import clsx from 'clsx';

const INDUSTRIES = [
  'All Industries', 'Software Development', 'Data Science & Analytics',
  'Cybersecurity', 'Cloud Infrastructure', 'Digital Design & Media',
];

export const Internships: React.FC = () => {
  const [internships, setInternships] = useState<Internship[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [industry, setIndustry] = useState('');
  const [isRemote, setIsRemote] = useState<boolean | undefined>(undefined);

  const load = async (p = 1) => {
    setIsLoading(true);
    try {
      const { data } = await internshipsApi.getAll({
        search: search || undefined,
        industry: industry || undefined,
        isRemote,
        page: p,
        limit: 12,
      });
      setInternships(data.data);
      setTotal(data.pagination.total);
      setPages(data.pagination.pages);
      setPage(p);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(1); }, [search, industry, isRemote]);

  const InternshipCard: React.FC<{ internship: Internship }> = ({ internship }) => (
    <Link to={`/internships/${internship.id}`}>
      <Card hover className="h-full flex flex-col">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-primary-700 font-bold text-lg shrink-0">
            {internship.employer.companyName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm leading-snug">{internship.title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{internship.employer.companyName}</p>
          </div>
        </div>

        <p className="text-xs text-gray-600 leading-relaxed flex-1 mb-3">
          {truncate(internship.description, 120)}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {internship.requiredSkills.slice(0, 4).map((rs) => (
            <Badge key={rs.id} size="sm" className="bg-gray-100 text-gray-600">
              {rs.skill.name}
            </Badge>
          ))}
          {internship.requiredSkills.length > 4 && (
            <Badge size="sm" className="bg-gray-100 text-gray-500">
              +{internship.requiredSkills.length - 4}
            </Badge>
          )}
        </div>

        <div className="border-t border-gray-50 pt-3 flex items-center gap-3 flex-wrap text-xs text-gray-400">
          {internship.location && (
            <span className="flex items-center gap-1"><MapPin size={11} />{internship.location.split(',')[0]}</span>
          )}
          {internship.isRemote && (
            <Badge size="sm" variant="success">Remote</Badge>
          )}
          {internship.stipend && (
            <span className="flex items-center gap-1 text-emerald-600 font-medium">
              <DollarSign size={11} />{formatCurrency(internship.stipend)}/mo
            </span>
          )}
          {internship.durationMonths && (
            <span className="flex items-center gap-1"><Clock size={11} />{internship.durationMonths} months</span>
          )}
        </div>

        {internship.applicationDeadline && (
          <p className="text-xs text-amber-600 mt-2">
            Deadline: {formatDate(internship.applicationDeadline)}
          </p>
        )}
      </Card>
    </Link>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Internship Listings</h2>
          <p className="text-sm text-gray-500 mt-0.5">{total} available positions</p>
        </div>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, company..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value === 'All Industries' ? '' : e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
          </select>
          <button
            onClick={() => setIsRemote(isRemote === true ? undefined : true)}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors',
              isRemote ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-gray-200 text-gray-600 hover:border-gray-300',
            )}
          >
            <Wifi size={14} /> Remote Only
          </button>
        </div>
      </Card>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-6 animate-pulse h-48">
              <div className="flex gap-3 mb-3">
                <div className="w-12 h-12 bg-gray-100 rounded-xl" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-100 rounded mb-2 w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-100 rounded" />
                <div className="h-3 bg-gray-100 rounded w-5/6" />
              </div>
            </div>
          ))}
        </div>
      ) : internships.length === 0 ? (
        <Card className="text-center py-16">
          <Briefcase size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-600 font-medium">No internships found</p>
          <p className="text-sm text-gray-400 mt-1">Try adjusting your filters.</p>
          <Button variant="outline" className="mt-4" onClick={() => { setSearch(''); setIndustry(''); setIsRemote(undefined); }}>
            Clear Filters
          </Button>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {internships.map((i) => <InternshipCard key={i.id} internship={i} />)}
          </div>
          {pages > 1 && (
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => load(page - 1)}>Previous</Button>
              <span className="px-4 py-2 text-sm text-gray-600">{page} / {pages}</span>
              <Button variant="outline" size="sm" disabled={page === pages} onClick={() => load(page + 1)}>Next</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Internships;
