"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Search, Download, Settings, LogOut, Users, Globe, ExternalLink, Zap, Loader2, Filter, AlertCircle,
  Star, ShieldCheck, ShieldAlert, Phone, History, Mail
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

export default function DashboardPage() {
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [title, setTitle] = useState('');
  const [limit, setLimit] = useState('10');
  const [source, setSource] = useState('free'); // 'free' or 'api'
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState(''); // Tracking background progress
  const [leads, setLeads] = useState([]);
  const [user, setUser] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [viewMode, setViewMode] = useState('none'); // 'current', 'history', or 'none'
  const router = useRouter();

  // 1. Verify User Login status (Dashboard stays fresh on mount/login)
  useEffect(() => {
    const checkUser = async () => {
      setErrorMsg('');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
      } else {
        setUser(user);
        setLeads([]);
        setViewMode('none');
      }
    };

    checkUser();
  }, [router]);

  // 2. Trigger asynchronous n8n webhook and poll Supabase for completion status
  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLeads([]);
    setViewMode('none');
    setIsSearching(true);
    setSearchStatus('Initializing background scraper...');

    const savedWebhookUrl = localStorage.getItem('n8n_webhook_url');
    if (!savedWebhookUrl) {
      setErrorMsg("Please configure your n8n Webhook URL in the Settings page first.");
      setIsSearching(false);
      return;
    }

    try {
      // Get current logged-in user session JWT token securely
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error("Your session has expired. Please log in again.");
      }
      const token = session.access_token;

      // POST to search-leads endpoint sending JWT token in Authorization header
      const response = await fetch('/api/search-leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          webhookUrl: savedWebhookUrl,
          keyword,
          location,
          title,
          limit: parseInt(limit, 10),
          source: source // 'free' or 'api'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to initiate background scrape.");
      }

      const data = await response.json();
      const requestId = data.requestId;

      setSearchStatus('Scraping leads via n8n (This might take 30-90 seconds)...');

      // 3. Client-side Polling: check the Supabase database every 3 seconds for results
      const interval = setInterval(async () => {
        const { data: campaign, error: pollError } = await supabase
          .from('lead_searches')
          .select('status, results_count')
          .eq('request_id', requestId)
          .single();

        if (pollError) {
          clearInterval(interval);
          setIsSearching(false);
          setErrorMsg("Failed to track progress of the scraping campaign.");
          return;
        }

        if (campaign.status === 'completed') {
          clearInterval(interval);
          setSearchStatus('Saving leads to database...');
          
          // Fetch the final scraped leads mapped to this specific campaign
          const { data: generatedLeads, error: leadsError } = await supabase
            .from('leads')
            .select('*')
            .eq('search_id', requestId);

          if (leadsError) {
            setErrorMsg("Scrape finished, but failed to load leads from database.");
          } else {
            setLeads(generatedLeads);
            setViewMode('current');
          }
          setIsSearching(false);
        } else if (campaign.status === 'failed') {
          clearInterval(interval);
          setIsSearching(false);
          setErrorMsg("Scraping campaign failed. Check n8n execution log.");
        }
      }, 3000);

    } catch (err) {
      setErrorMsg(err.message || "An error occurred while communicating with backend.");
      setIsSearching(false);
    }
  };

  // 4. Fetch and Load all previously saved leads from Supabase (History Archive)
  const handleLoadHistory = async () => {
    if (!user) return;
    setIsSearching(true);
    setSearchStatus('Loading leads database...');
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

  // 5. Download currently viewed table results as CSV
  const handleExportCSV = () => {
    if (leads.length === 0) return;

    const headers = ["Business Name", "Category", "Rating", "Total Reviews", "Verified / Claimed", "Raw Phone", "WhatsApp Number", "Facebook Page", "Website", "Keyword Used", "Location"];
    
    const rows = leads.map(lead => [
      `"${lead.name?.replace(/"/g, '""') || 'N/A'}"`,
      `"${lead.category?.replace(/"/g, '""') || 'N/A'}"`,
      lead.rating || 'N/A',
      lead.reviews_count !== null ? lead.reviews_count : '0',
      lead.is_claimed === true ? "Yes" : (lead.is_claimed === false ? "No" : "Unknown"),
      `"${lead.phone || 'N/A'}"`,
      `"${lead.formatted_phone || 'N/A'}"`,
      lead.facebook || 'N/A',
      lead.website || 'N/A',
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
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0 block"></span> Ready to Sync
                </span>
              </div>
            </div>
          </div>

          {/* Error Message Alert */}
          {errorMsg && (
            <div className="p-4 bg-red-50 text-red-700 text-sm font-medium rounded-xl border border-red-100 flex items-center gap-2.5">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form and Filters */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Filter className="h-5 w-5 text-indigo-600" /> Lead Generation Criteria
            </h2>
            <form onSubmit={handleSearchSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
              </div>

              {/* Scraping Dual-Route Selector and Submit Button */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Scraping Engine Mode</label>
                  <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:max-w-md">
                    <button
                      type="button"
                      onClick={() => setSource('free')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${source === 'free' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      ⚡ Free Scrape (No Cost)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSource('api')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${source === 'api' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      💎 Premium API (Apify)
                    </button>
                  </div>
                </div>
                <div className="flex flex-col justify-end items-end">
                  <button 
                    type="submit" 
                    disabled={isSearching}
                    className="w-full sm:max-w-xs bg-indigo-600 text-white hover:bg-indigo-700 font-semibold text-sm py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition disabled:bg-indigo-400 h-[38px]"
                  >
                    {isSearching ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> {searchStatus}
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" /> Start Generating
                      </>
                    )}
                  </button>
                </div>
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
                  {viewMode === 'history' ? 'Displaying all historical leads saved in your account.' : (viewMode === 'current' ? 'Displaying freshly generated leads from your last search.' : 'Submit a search above or click &quot;Load Saved Leads&quot; to view your historical archive.')}
                </p>
              </div>
              <div className="flex gap-2">
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
                      <th className="py-3 px-6">Facebook</th>
                      <th className="py-3 px-6">Action (WhatsApp CRM)</th>
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
                          {/* Display Email if scraped */}
                          {lead.email && lead.email !== 'N/A' && (
                            <span className="flex items-center gap-1.5 text-xs text-indigo-600 font-medium">
                              <Mail className="h-3.5 w-3.5 text-indigo-500" /> {lead.email}
                            </span>
                          )}
                          <span className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                            <Phone className="h-3.5 w-3.5 text-slate-400" /> 
                            {lead.phone && lead.phone !== 'N/A' ? lead.phone : <span className="text-slate-400 font-normal">Phone not found</span>}
                          </span>
                        </td>

                        {/* 4. Facebook SVG Icon Only */}
                        <td className="py-4 px-6">
                          {lead.facebook && lead.facebook !== 'N/A' ? (
                            <a 
                              href={lead.facebook} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition inline-block" 
                              title="Facebook Page"
                            >
                              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                              </svg>
                            </a>
                          ) : (
                            <span className="text-slate-400 text-xs">No Facebook Page</span>
                          )}
                        </td>

                        {/* 5. Action (Direct WhatsApp CRM link) */}
                        <td className="py-4 px-6">
                          {lead.formatted_phone && lead.formatted_phone !== 'N/A' ? (
                            <a 
                              href={`https://wa.me/${lead.formatted_phone.replace(/[^\d]/g, '')}`} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-lg transition shadow-sm"
                              title="Initiate chat in WhatsApp CRM"
                            >
                              {/* Official WhatsApp SVG Logo */}
                              <svg className="h-4 w-4 fill-current text-white" viewBox="0 0 24 24">
                                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.051 11.945.051a11.83 11.83 0 0 1 8.44 3.504 11.75 11.75 0 0 1 3.524 8.423c-.005 6.597-5.341 11.895-11.892 11.895-2.003-.001-3.972-.511-5.711-1.487L0 24zm6.59-4.846c1.6.95 3.197 1.451 4.793 1.453 5.436 0 9.852-4.385 9.855-9.77a9.7 9.7 0 0 0-2.911-6.953 9.77 9.77 0 0 0-6.957-2.915C6.012 1.919 1.597 6.305 1.593 11.69c-.001 1.749.493 3.42 1.427 4.887L1.936 21.03l4.711-1.876z"/>
                              </svg>
                              <span>WhatsApp CRM</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 text-xs">No CRM Action</span>
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
                    <p className="text-slate-500 text-xs mt-1">Submit a search above or click &quot;Load Saved Leads&quot; to view your historical archive.</p>
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