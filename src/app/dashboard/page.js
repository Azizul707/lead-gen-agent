"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Search, Download, Settings, LogOut, Users, Globe, ExternalLink, Zap, Loader2, Filter, AlertCircle,
  Star, ShieldCheck, ShieldAlert, Mail, Phone, History
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function DashboardPage() {
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [title, setTitle] = useState('');
  const [limit, setLimit] = useState('10');
  const [isSearching, setIsSearching] = useState(false);
  const [leads, setLeads] = useState([]);
  const [user, setUser] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [viewMode, setViewMode] = useState('none'); // 'current', 'history', or 'none'
  const router = useRouter();

  // 1. Verify User Login status (Keep dashboard fresh - do not auto-load leads on mount)
  useEffect(() => {
    const checkUser = async () => {
      setErrorMsg('');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
      } else {
        setUser(user);
        // Table remains fresh (empty) upon fresh login/mount
        setLeads([]);
        setViewMode('none');
      }
    };

    checkUser();
  }, [router]);

  // 2. Trigger n8n Webhook and Save freshly scraped leads to Supabase
  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLeads([]); // Clear the table first to keep it completely fresh for the new campaign
    setViewMode('none');
    setIsSearching(true);

    const savedWebhookUrl = localStorage.getItem('n8n_webhook_url');
    if (!savedWebhookUrl) {
      setErrorMsg("Please configure your n8n Webhook URL in the Settings page first.");
      setIsSearching(false);
      return;
    }

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhookUrl: savedWebhookUrl,
          keyword,
          location,
          title,
          limit: parseInt(limit, 10),
          user_id: user.id
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to connect to n8n.");
      }

      const data = await response.json();

      let incomingLeads = [];
      if (Array.isArray(data)) {
        incomingLeads = data;
      } else if (data && Array.isArray(data.leads)) {
        incomingLeads = data.leads;
      } else {
        const rawReceived = JSON.stringify(data).substring(0, 150);
        throw new Error(`Invalid response format from n8n. Expected an array of leads, but received: ${rawReceived}...`);
      }

      if (incomingLeads.length === 0) {
        setErrorMsg("n8n executed successfully, but no leads were found for this search.");
        setIsSearching(false);
        return;
      }

      const leadsToInsert = incomingLeads.map((lead) => ({
        user_id: user.id,
        name: lead.title || lead.name || 'N/A',
        email: lead.email || lead.contactEmail || 'N/A',
        phone: lead.phone || 'N/A',
        company: lead.title || lead.company || 'N/A',
        title: lead.categoryName || lead.title || 'N/A',
        website: lead.website || 'N/A',
        keyword: keyword,
        location: location,
        rating: lead.totalScore !== undefined ? lead.totalScore : (lead.rating || null),
        reviews_count: lead.reviewsCount !== undefined ? lead.reviewsCount : (lead.reviews_count || null),
        is_claimed: lead.isClaimed !== undefined ? lead.isClaimed : null,
        category: lead.categoryName || lead.category || 'N/A',
        facebook: lead.facebook || lead.facebookUrl || null,
        instagram: lead.instagram || lead.instagramUrl || null,
        twitter: lead.twitter || lead.twitterUrl || null,
        linkedin: lead.linkedin || lead.linkedinUrl || null
      }));

      const { data: insertedData, error: insertError } = await supabase
        .from('leads')
        .insert(leadsToInsert)
        .select();

      if (insertError) throw insertError;

      if (insertedData) {
        setLeads(insertedData); // Only display the newly generated leads to keep current workspace fresh
        setViewMode('current');
      }

    } catch (err) {
      setErrorMsg(err.message || "An error occurred while communicating with n8n.");
    } finally {
      setIsSearching(false);
    }
  };

  // 3. Fetch and Load all previously saved leads from Supabase on demand (History Button)
  const handleLoadHistory = async () => {
    if (!user) return;
    setIsSearching(true);
    setErrorMsg('');
    setLeads([]);
    setViewMode('none');

    try {
      const { data: savedLeads, error } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (savedLeads && savedLeads.length > 0) {
        setLeads(savedLeads);
        setViewMode('history');
      } else {
        setErrorMsg("No saved leads found in your account database.");
        setLeads([]);
        setViewMode('none');
      }
    } catch (err) {
      setErrorMsg(err.message || "Failed to load saved leads archive.");
    } finally {
      setIsSearching(false);
    }
  };

  // 4. Download currently viewed table results as CSV
  const handleExportCSV = () => {
    if (leads.length === 0) return;

    const headers = ["Business Name", "Category", "Rating", "Total Reviews", "Verified / Claimed", "Email", "Phone", "Website", "Facebook", "Instagram", "Twitter", "LinkedIn", "Keyword Used", "Location"];
    
    const rows = leads.map(lead => [
      `"${lead.name?.replace(/"/g, '""') || 'N/A'}"`,
      `"${lead.category?.replace(/"/g, '""') || 'N/A'}"`,
      lead.rating || 'N/A',
      lead.reviews_count !== null ? lead.reviews_count : '0',
      lead.is_claimed === true ? "Yes" : (lead.is_claimed === false ? "No" : "Unknown"),
      lead.email || 'N/A',
      lead.phone || 'N/A',
      lead.website || 'N/A',
      lead.facebook || 'N/A',
      lead.instagram || 'N/A',
      lead.twitter || 'N/A',
      lead.linkedin || 'N/A',
      `"${lead.keyword || 'N/A'}"`,
      `"${lead.location || 'N/A'}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `leadflow_${viewMode === 'history' ? 'history' : 'current'}_leads.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLogOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 hidden md:flex flex-col justify-between border-r border-slate-800">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
              <Zap className="h-5 w-5" />
            </div>
            <span className="font-bold text-lg text-white">LeadFlow AI</span>
          </div>
          
          <nav className="space-y-1">
            <Link 
              href="/dashboard" 
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-medium transition"
            >
              <Search className="h-5 w-5" /> Search Agent
            </Link>
            <Link 
              href="/settings" 
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-slate-800 hover:text-white font-medium transition"
            >
              <Settings className="h-5 w-5" /> Settings
            </Link>
          </nav>
        </div>

        <div className="p-6 border-t border-slate-800">
          <button 
            onClick={handleLogOut}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-red-950/40 hover:text-red-400 font-medium transition text-slate-400 text-left"
          >
            <LogOut className="h-5 w-5" /> Log Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 md:px-8">
          <h1 className="font-bold text-xl text-slate-900">Lead Search Agent</h1>
          <div className="flex items-center gap-4">
            <Link 
              href="/settings" 
              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition md:hidden"
            >
              <Settings className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                {user?.email ? user.email[0].toUpperCase() : 'U'}
              </div>
              <span className="text-sm font-semibold text-slate-700 hidden sm:inline-block">
                {user?.email || 'User Dashboard'}
              </span>
            </div>
          </div>
        </header>

        <div className="p-6 md:p-8 max-w-7xl mx-auto w-full space-y-6">
          
          {/* Stats Cards Section */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 flex items-center gap-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 block">Current leads in table</span>
                <span className="text-2xl font-bold text-slate-900">{leads.length}</span>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <Search className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 block">Active Workspace</span>
                <span className="text-sm font-bold text-indigo-600 block mt-1">Supabase Sandbox</span>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Zap className="h-6 w-6" />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-500 block">n8n Status</span>
                <span className="text-sm font-bold text-emerald-600 flex items-center gap-1.5 mt-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse block"></span> Ready to Sync
                </span>
              </div>
            </div>
          </div>

          {/* Error Message Alert */}
          {errorMsg && (
            <div className="p-4 bg-red-50 text-red-700 text-sm font-medium rounded-xl border border-red-100 flex items-center gap-2.5">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form and Filters */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Filter className="h-5 w-5 text-indigo-600" /> Lead Generation Criteria
            </h2>
            <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Niche / Keyword</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Real Estate, Dentist" 
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Location</label>
                <input 
                  type="text" 
                  placeholder="e.g. New York, London" 
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Target Job Title</label>
                <input 
                  type="text" 
                  placeholder="e.g. CEO, Founder" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Lead Limit</label>
                <input 
                  type="number" 
                  min="1"
                  max="100"
                  required 
                  placeholder="e.g. 10" 
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div className="flex flex-col justify-end">
                <button 
                  type="submit" 
                  disabled={isSearching}
                  className="w-full bg-indigo-600 text-white hover:bg-indigo-700 font-semibold text-sm py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition disabled:bg-indigo-400 h-[38px]"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Fetching n8n...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" /> Start Generating
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Leads Results Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  {viewMode === 'history' ? 'Saved Leads Archive' : (viewMode === 'current' ? 'Current Search Results' : 'Workspace Table')}
                </h3>
                <p className="text-slate-500 text-xs">
                  {viewMode === 'history' ? 'Displaying all historical leads saved in your account.' : (viewMode === 'current' ? 'Displaying freshly generated leads from your last search.' : 'Submit a search above or load your saved leads history.')}
                </p>
              </div>
              <div className="flex gap-2">
                {/* 1. New Load Saved Leads History Button */}
                <button 
                  onClick={handleLoadHistory}
                  disabled={isSearching}
                  className="self-start sm:self-center inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs py-2 px-3 rounded-lg transition disabled:opacity-50"
                  title="Load saved leads archive from database"
                >
                  <History className="h-4 w-4 text-indigo-600" /> Load Saved Leads
                </button>
                {leads.length > 0 && (
                  <button 
                    onClick={handleExportCSV}
                    className="self-start sm:self-center inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 px-3 rounded-lg transition"
                  >
                    <Download className="h-4 w-4" /> Export CSV
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              {leads.length > 0 ? (
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase border-b border-slate-100">
                      <th className="py-3 px-6">Business Name</th>
                      <th className="py-3 px-6">Rating & GMB Status</th>
                      <th className="py-3 px-6">Contact Info</th>
                      <th className="py-3 px-6">Socials</th>
                      <th className="py-3 px-6">Website</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {leads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-slate-50/50 transition">
                        {/* 1. Name and Category */}
                        <td className="py-4 px-6">
                          <span className="block font-bold text-slate-900 leading-tight">{lead.name}</span>
                          <span className="inline-block text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full mt-1">
                            {lead.category || lead.title || 'Local Business'}
                          </span>
                        </td>
                        
                        {/* 2. Rating and Claimed status */}
                        <td className="py-4 px-6 space-y-2">
                          {lead.rating ? (
                            <span className="flex items-center gap-1 text-slate-800 text-xs font-semibold">
                              <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                              {lead.rating} <span className="text-slate-400 font-normal">({lead.reviews_count || 0} reviews)</span>
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 block">No Rating</span>
                          )}
                          
                          {/* Claimed Status Badge */}
                          {lead.is_claimed === true ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                              <ShieldCheck className="h-3 w-3 text-emerald-500" /> Verified GMB
                            </span>
                          ) : lead.is_claimed === false ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">
                              <ShieldAlert className="h-3 w-3 text-rose-500" /> Unclaimed Profile
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                              Unknown GMB
                            </span>
                          )}
                        </td>

                        {/* 3. Contact Info */}
                        <td className="py-4 px-6 space-y-1">
                          <span className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                            <Mail className="h-3.5 w-3.5 text-indigo-500" /> 
                            {lead.email && lead.email !== 'N/A' ? lead.email : <span className="text-slate-400 font-normal">Email not found</span>}
                          </span>
                          <span className="flex items-center gap-1.5 text-xs text-slate-600">
                            <Phone className="h-3.5 w-3.5 text-slate-400" /> 
                            {lead.phone && lead.phone !== 'N/A' ? lead.phone : <span className="text-slate-400 font-normal">Phone not found</span>}
                          </span>
                        </td>

                        {/* 4. Social Media Brand SVGs */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            {lead.facebook && (
                              <a href={lead.facebook} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition" title="Facebook">
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                                </svg>
                              </a>
                            )}
                            {lead.instagram && (
                              <a href={lead.instagram} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-pink-50 text-pink-600 hover:bg-pink-100 rounded-lg transition" title="Instagram">
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                                </svg>
                              </a>
                            )}
                            {lead.twitter && (
                              <a href={lead.twitter} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-sky-50 text-sky-600 hover:bg-sky-100 rounded-lg transition" title="Twitter / X">
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
                                </svg>
                              </a>
                            )}
                            {lead.linkedin && (
                              <a href={lead.linkedin} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition" title="LinkedIn">
                                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                                  <rect x="2" y="9" width="4" height="12" />
                                  <circle cx="4" cy="4" r="2" />
                                </svg>
                              </a>
                            )}
                            {!lead.facebook && !lead.instagram && !lead.twitter && !lead.linkedin && (
                              <span className="text-slate-400 text-xs">No Socials Found</span>
                            )}
                          </div>
                        </td>

                        {/* 5. Website URL */}
                        <td className="py-4 px-6">
                          {lead.website && lead.website !== 'N/A' ? (
                            <a 
                              href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 hover:underline text-xs font-bold bg-indigo-50 px-2.5 py-1.5 rounded-lg transition"
                            >
                              <Globe className="h-3.5 w-3.5" /> Visit Website <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-slate-400 text-xs">No Website</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-16 text-center">
                  <div className="max-w-xs mx-auto">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400 mb-3">
                      <Search className="h-6 w-6" />
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">No leads generated yet</h4>
                    <p className="text-slate-500 text-xs mt-1">Submit a search above or click <strong>Load Saved Leads</strong> to view your historical archive.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}