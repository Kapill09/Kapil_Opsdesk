import Link from 'next/link';
import { Briefcase, LayoutDashboard, Users, User } from 'lucide-react';
import { CurrentUser } from '../lib/auth';

export function Sidebar({ user }: { user: CurrentUser | null }) {
  return (
    <div className="w-64 bg-slate-900 text-slate-300 min-h-screen flex flex-col flex-shrink-0">
      <div className="p-6 text-2xl font-bold text-white border-b border-slate-800 flex items-center gap-2">
        <Briefcase className="text-blue-500" />
        OpsDesk
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <Link href="/" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 hover:text-white transition font-medium">
          <LayoutDashboard size={20} />
          Dashboard
        </Link>
        <Link href="/work-items" className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800 hover:text-white transition font-medium">
          <Briefcase size={20} />
          Work Items
        </Link>
        <div className="flex items-center gap-3 p-3 rounded-lg opacity-50 cursor-not-allowed font-medium">
          <Users size={20} />
          Teams
        </div>
      </nav>
      {user && (
        <div className="p-4 border-t border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold flex-shrink-0">
            <User size={20} />
          </div>
          <div className="text-sm truncate">
            <p className="font-semibold text-white truncate">{user.name}</p>
            <p className="text-slate-400 text-xs truncate">Dev Identity</p>
          </div>
        </div>
      )}
    </div>
  );
}
