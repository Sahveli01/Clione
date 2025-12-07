import Link from "next/link";
import { ArrowRight, Lock, Zap, Shield, Globe, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-purple-950/20 to-gray-950 text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-radial from-purple-500/10 to-transparent rounded-full blur-3xl" />
          <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-radial from-pink-500/10 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 py-24">
          <div className="text-center space-y-6">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-full">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-300">Serverless Paywall Protocol</span>
            </div>

            {/* Title */}
            <h1 className="text-6xl md:text-7xl font-bold">
              <span className="text-gradient-glow">
                Clione
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mx-auto">
              The decentralized marketplace for digital content.
              <br />
              <span className="text-gray-300">Sell anything. Zero servers. Instant payouts.</span>
            </p>

            {/* CTA Button */}
            <div className="flex justify-center mt-8">
              <Link
                href="/generate"
                className="btn-primary"
              >
                <Lock className="w-5 h-5" />
                Start Selling
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="glass-card">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Client-Side Encryption</h3>
            <p className="text-gray-400">
              Files are encrypted in your browser before upload. Only buyers with the link can decrypt.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="glass-card">
            <div className="w-12 h-12 bg-pink-500/20 rounded-xl flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-pink-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Instant Payouts</h3>
            <p className="text-gray-400">
              Payments go directly to your wallet. No middleman, no waiting, no fees beyond gas.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="glass-card">
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4">
              <Globe className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Wallet Required</h3>
            <p className="text-gray-400">
              Buyers login with Google via zkLogin. No wallet setup, no seed phrases.
            </p>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
        
        <div className="space-y-6">
          {/* Step 1 */}
          <div className="glass-card flex items-start gap-4">
            <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center shrink-0">
              <span className="text-purple-400 font-bold">1</span>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">Upload & Encrypt</h3>
              <p className="text-gray-400">
                Upload your file. It&apos;s encrypted locally with AES-256 before leaving your browser.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="glass-card flex items-start gap-4">
            <div className="w-10 h-10 bg-pink-500/20 rounded-full flex items-center justify-center shrink-0">
              <span className="text-pink-400 font-bold">2</span>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">Set Your Price</h3>
              <p className="text-gray-400">
                Choose your price in SUI. Create a listing on the Sui blockchain.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="glass-card flex items-start gap-4">
            <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center shrink-0">
              <span className="text-blue-400 font-bold">3</span>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">Share the Link</h3>
              <p className="text-gray-400">
                Get a unique link with the decryption key embedded. Share it anywhere.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="glass-card flex items-start gap-4">
            <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center shrink-0">
              <span className="text-green-400 font-bold">4</span>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-1">Get Paid Instantly</h3>
              <p className="text-gray-400">
                When someone buys, payment goes directly to your wallet. They unlock and download instantly.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Use Cases */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-4">Perfect For</h2>
        <p className="text-gray-400 text-center mb-12">Any digital content you want to monetize</p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            "📄 Documents",
            "🎵 Music & Audio",
            "📸 Photos & Art",
            "📹 Videos",
            "📚 E-Books",
            "💻 Code & Scripts",
            "🎮 Game Assets",
            "🎓 Courses",
          ].map((item) => (
            <div 
              key={item}
              className="glass-card p-4 text-center"
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="p-8 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-2xl text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Selling?</h2>
          <p className="text-gray-400 mb-8">
            No sign-up required. Connect your wallet and create your first listing in minutes.
          </p>
          <Link
            href="/generate"
            className="btn-primary"
          >
            Create Your First Listing
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </main>
  );
}
