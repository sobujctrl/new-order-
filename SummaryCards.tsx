import React from 'react';
import { Users, PhoneCall, TrendingUp } from 'lucide-react';
import { SummaryStats } from '../../services/leadService';
import { toBengaliNumerals, formatTaka } from '../../utils/formatters';

interface SummaryCardsProps {
  stats: SummaryStats;
  selectedSourceFilter: string;
  onSelectSource: (source: string) => void;
  isFollowUpFilterActive: boolean;
  onToggleFollowUpFilter: () => void;
  isTodayNewFilterActive: boolean;
  onToggleTodayNewFilter: () => void;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  stats,
  selectedSourceFilter,
  onSelectSource,
  isFollowUpFilterActive,
  onToggleFollowUpFilter,
  isTodayNewFilterActive,
  onToggleTodayNewFilter,
}) => {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-3">
      {/* 1. Total Leads */}
      <div
        onClick={() => onSelectSource('all')}
        className={`group cursor-pointer rounded-xl border p-4 transition-all hover:shadow-sm ${
          selectedSourceFilter === 'all' && !isFollowUpFilterActive && !isTodayNewFilterActive
            ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500 dark:border-blue-400 dark:bg-blue-950/30'
            : 'border-slate-200/80 bg-white hover:border-slate-300 dark:border-slate-700/80 dark:bg-[#1e293b] dark:hover:border-slate-600'
        }`}
      >
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span className="text-xs font-semibold">মোট লিড</span>
          <div className="rounded-lg bg-slate-100 p-1.5 dark:bg-slate-800">
            <Users className="h-4 w-4 text-slate-700 dark:text-slate-300" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums dark:text-white">
            {toBengaliNumerals(stats.totalLeads)}
          </span>
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            {formatTaka(stats.totalEstimatedPipelineValue)}
          </span>
        </div>
      </div>

      {/* 2. Today's New Leads */}
      <div
        onClick={onToggleTodayNewFilter}
        className={`group cursor-pointer rounded-xl border p-4 transition-all hover:shadow-sm ${
          isTodayNewFilterActive
            ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-500 dark:border-blue-400 dark:bg-blue-950/40'
            : 'border-slate-200/80 bg-white hover:border-slate-300 dark:border-slate-700/80 dark:bg-[#1e293b] dark:hover:border-slate-600'
        }`}
      >
        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
          <span className="text-xs font-semibold">আজকের নতুন</span>
          <div className="rounded-lg bg-blue-100/70 p-1.5 dark:bg-blue-950">
            <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-2xl font-bold tracking-tight text-blue-600 tabular-nums dark:text-blue-400">
            {toBengaliNumerals(stats.todayNewLeads)}
          </span>
          <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300">
            {isTodayNewFilterActive ? 'ফিল্টার চালু' : 'আজ প্রাপ্ত'}
          </span>
        </div>
      </div>

      {/* 3. Today's Follow-up */}
      <div
        onClick={onToggleFollowUpFilter}
        className={`group cursor-pointer rounded-xl border p-4 transition-all hover:shadow-sm ${
          isFollowUpFilterActive
            ? 'border-amber-500 bg-amber-50/60 ring-1 ring-amber-500 dark:border-amber-400 dark:bg-amber-950/40'
            : 'border-slate-200/80 bg-white hover:border-slate-300 dark:border-slate-700/80 dark:bg-[#1e293b] dark:hover:border-slate-600'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">আজকের ফলো-আপ</span>
          <div className="rounded-lg bg-amber-100/70 p-1.5 dark:bg-amber-950">
            <PhoneCall className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-2xl font-bold tracking-tight text-amber-600 tabular-nums dark:text-amber-400">
            {toBengaliNumerals(stats.todayFollowUpCount)}
          </span>
          <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
            {isFollowUpFilterActive ? 'ফিল্টার চালু' : 'পেন্ডিং'}
          </span>
        </div>
      </div>
    </div>
  );
};
