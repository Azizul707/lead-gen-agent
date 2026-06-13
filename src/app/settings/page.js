"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Search, Settings, LogOut, Zap, Save, Link2, CheckCircle2, AlertCircle 
} from 'lucide-react';

export default function SettingsPage() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success' or 'error'

  useEffect(() => {
    const savedUrl = localStorage.getItem('n8n_webhook_url');
    if (savedUrl) {
      // Defer state update using setTimeout to avoid synchronous cascading renders warning from ESLint
      setTimeout(() => {
        setWebhookUrl(savedUrl);
      }, 0);
    }
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus(null);

    try {
      if (webhookUrl && (webhookUrl.startsWith('http://') || webhookUrl.startsWith('https://'))) {
        localStorage.setItem('n8n_webhook_url', webhookUrl);
        
        setTimeout(() => {
          setSaveStatus('success');
          setIsSaving(false);
        }, 1000);
      } else {
        setSaveStatus('error');
        setIsSaving(false);
      }
    } catch (err) {
      setSaveStatus('error');
      setIsSaving(false);
    }
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
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-slate-800 hover:text-white font-medium transition"
            >
              <Search className="h-5 w-5" /> Search Agent
            </Link>
            <Link 
              href="/settings" 
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-indigo-600 text-white font-medium transition"
            >
              <Settings className="h-5 w-5" /> Settings
            </Link>
          </nav>
        </div>

        <div className="p-6 border-t border-slate-800">
          <Link 
            href="/" 
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-red-950/40 hover:text-red-400 font-medium transition text-slate-400"
          >
            <LogOut className="h-5 w-5" /> Log Out
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Navbar */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 md:px-8">
          <h1 className="font-bold text-xl text-slate-900">Settings</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                U
              </div>
              <span className="text-sm font-semibold text-slate-700 hidden sm:inline-block">User Dashboard</span>
            </div>
          </div>
        </header>

        {/* Settings Content */}
        <div className="p-6 md:p-8 max-w-3xl mx-auto w-full space-y-6">
          
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="border-b border-slate-100 pb-4 mb-6">
              <h2 className="text-lg font-bold text-slate-900">n8n Automation Integration</h2>
              <p className="text-slate-500 text-xs mt-1">
                Configure your n8n workflow Webhook URL here. This endpoint is used to trigger your lead generation agent in real-time.
              </p>
            </div>

            {/* Save Status Notifications */}
            {saveStatus === 'success' && (
              <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-xl border border-emerald-100 flex items-center gap-2.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                <span>Settings saved successfully! Your agent will now use this Webhook URL.</span>
              </div>
            )}

            {saveStatus === 'error' && (
              <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm font-medium rounded-xl border border-red-100 flex items-center gap-2.5">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                <span>Please enter a valid Webhook URL starting with http:// or https://</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Link2 className="h-4 w-4 text-indigo-600" /> n8n Webhook URL
                </label>
                <input 
                  type="text" 
                  required 
                  placeholder="https://primary-production.up.railway.app/webhook/..." 
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm placeholder-slate-400"
                />
                <span className="block text-slate-400 text-[11px] mt-2 leading-relaxed">
                  * Paste the <strong>Production URL</strong> (or <strong>Test URL</strong> during development) obtained after configuring your Webhook Node in n8n.
                </span>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm py-2 px-5 rounded-xl transition shadow-md disabled:bg-indigo-400"
                >
                  {isSaving ? 'Saving...' : (
                    <>
                      <Save className="h-4 w-4" /> Save Settings
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

        </div>
      </main>
    </div>
  );
}