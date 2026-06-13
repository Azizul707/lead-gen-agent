import Link from 'next/link';
import { ArrowRight, CheckCircle, Zap, Database, Shield, Search } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navigation Bar */}
      <nav className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <Zap className="h-5 w-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-indigo-900">LeadFlow AI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition">
              Log in
            </Link>
            <Link 
              href="/login" 
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition shadow-sm"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="py-20 lg:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 rounded-full mb-6">
          <Zap className="h-3 w-3" /> Powered by n8n Automation
        </span>
        <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight max-w-3xl mx-auto leading-tight">
          Find Your Next High-Paying <span className="text-indigo-600">Leads in Seconds</span>
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto">
          Automate your cold outreach with our advanced lead generation agent. Instantly gather emails, phone numbers, and social profiles.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-md gap-2"
          >
            Start Generating Leads <ArrowRight className="h-5 w-5" />
          </Link>
          <a 
            href="#features" 
            className="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition"
          >
            Learn More
          </a>
        </div>
      </header>

      {/* Feature Section */}
      <section id="features" className="py-20 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-slate-900">Why Choose LeadFlow AI?</h2>
            <p className="mt-4 text-slate-600">Our seamless integration with automated workflows ensures fresh, highly accurate, and targeted leads for your business.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-5">
                <Search className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Smart Searching</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Filter by niche, location, job titles, and company size to pinpoint your exact ideal customers.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-5">
                <Database className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">n8n Workflow Integration</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Runs on top of n8n webhook automation, giving you reliable and fast data scraping capabilities.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-5">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Verified Data</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                Automatically verify emails to prevent bounce rates, keeping your outreach campaign safe and effective.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-slate-900">How It Works</h2>
          <p className="mt-4 text-slate-600">Get your lead database ready in three simple steps.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center mb-4">1</div>
            <h4 className="font-bold text-lg text-slate-900 mb-2">Define Your Audience</h4>
            <p className="text-sm text-slate-600">Enter your target keywords, job titles, and location in our clean dashboard.</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center mb-4">2</div>
            <h4 className="font-bold text-lg text-slate-900 mb-2">Trigger n8n Agent</h4>
            <p className="text-sm text-slate-600">Our webhook instantly sends request details to your custom n8n workflow.</p>
          </div>
          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center mb-4">3</div>
            <h4 className="font-bold text-lg text-slate-900 mb-2">Download CSV</h4>
            <p className="text-sm text-slate-600">Watch the leads flow into your table in real-time and export them with one click.</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-indigo-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to automate your pipeline?</h2>
          <p className="text-indigo-200 mb-8 max-w-xl mx-auto">Get instant access to your automated B2B lead generation tool and grow your sales today.</p>
          <Link 
            href="/dashboard" 
            className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-indigo-900 bg-white hover:bg-slate-100 rounded-xl transition shadow-lg gap-2"
          >
            Start For Free <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-indigo-500" />
            <span className="font-bold text-lg text-white">LeadFlow AI</span>
          </div>
          <p className="text-sm">&copy; {new Date().getFullYear()} LeadFlow AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}