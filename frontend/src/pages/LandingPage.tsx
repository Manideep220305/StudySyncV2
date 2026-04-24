import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import FadeIn from '../components/animations/FadeIn';
import { GlowingEffect } from '../components/ui/glowing-effect';
import { AuroraBackground } from '../components/ui/aurora-background';
import { Button } from '../components/ui/button';
import { Trophy, BarChart3, ScanText, Timer, FolderOpen, MessageCircle, Hash, Users, Zap, Sparkles, FileText, BrainCircuit } from 'lucide-react';

// --- TypeScript: Props for LandingPage ---
// This tells TypeScript that LandingPage expects a function called onOpenAuth.
interface LandingPageProps {
  onOpenAuth: (view: 'login' | 'register') => void;
}

// LandingPage is the public face of the app. It's fully responsive,
// uses framer-motion for scroll-triggered "Fade In" animations, and
// integrates complex UI components (AuroraBackground, GlowingEffect) from aceternity/shadcn.
const LandingPage = ({ onOpenAuth }: LandingPageProps) => {
  
  // Array of features mapped dynamically in the "Features Grid" below.
  const features = [
    {
      icon: <MessageCircle size={28} />,
      title: "Real-Time Study Rooms",
      desc: "Dedicated namespaces for focused study. Chat in real-time and share knowledge with your peers effortlessly."
    },
    {
      icon: <BrainCircuit size={28} />,
      title: "AI Quiz Generation",
      desc: "Instantly generate custom quizzes from your AI-context. Test your knowledge on the fly to reinforce learning."
    },
    {
      icon: <Trophy size={28} />,
      title: "Competitive Leaderboards",
      desc: "Gamify your grind. Earn points for taking quizzes and staying focused, then compete globally for the top spot."
    },
    {
      icon: <Timer size={28} />,
      title: "Group Focus Timer",
      desc: "Sync your Pomodoro sessions with the room. When the timer starts, everyone locks in and studies together."
    },
    {
      icon: <ScanText size={28} />,
      title: "AI Material Analysis",
      desc: "Connect to the robust RAG backend pipeline. Summarize study materials, extract text, and ask interactive questions."
    },
    {
      icon: <BarChart3 size={28} />,
      title: "Deep User Analytics",
      desc: "Visualize your progress. Track your total focus time, active streaks, points gathered, and overall study velocity."
    }
  ];

  return (
    // AuroraBackground provides the animated starry/aurora sky effect
    <AuroraBackground className="bg-[#020617] text-white selection:bg-blue-500/30">
      
      {/* Pass the prop correctly to Navbar so the 'Get Started' button works */}
      <Navbar onOpenAuth={onOpenAuth} />

      <div className="relative z-10 flex flex-col w-full">
        
        {/* --- HERO SECTION --- */}
        <section className="pt-40 pb-20 lg:pt-48 lg:pb-32">
          <div className="container mx-auto px-4 text-center">
              
              {/* FadeIn wraps individual elements for staggered animations */}
              <FadeIn>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-sm mb-8 hover:bg-blue-500/20 transition cursor-pointer backdrop-blur-sm">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                      </span>
                      v2.0: Public Study Rooms are Live
                  </div>
              </FadeIn>

              <FadeIn delay={0.1}>
                  <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-tight max-w-5xl mx-auto text-white drop-shadow-2xl">
                      Make studying <br />
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400">
                          collaborative & addictive.
                      </span>
                  </h1>
              </FadeIn>

              <FadeIn delay={0.2}>
                  <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed drop-shadow-sm">
                      Stop studying alone. Join real-time rooms, track your focus streaks, 
                      and climb the leaderboard. Productivity meets multiplayer gaming.
                  </p>
              </FadeIn>

              <FadeIn delay={0.3}>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                      <Button 
                          size="lg" 
                          // Open Auth modal in Register mode
                          onClick={() => onOpenAuth('register')}
                          className="h-14 px-8 text-lg bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg shadow-blue-500/25 transition-transform active:scale-95 border-0"
                      >
                          Start Syncing Free
                      </Button>
                      
                      <Button variant="ghost" size="lg" className="h-14 px-8 text-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition-transform active:scale-95 backdrop-blur-md">
                          View Demo Room
                      </Button>
                  </div>
              </FadeIn>

              {/* --- HERO DASHBOARD VISUAL (MOCKUP) --- */}
              <FadeIn delay={0.5} className="mt-20 relative max-w-6xl mx-auto px-2">
                  <div className="relative rounded-2xl border border-white/10 bg-slate-950/40 backdrop-blur-xl shadow-2xl overflow-hidden aspect-[16/9] md:aspect-[21/9] group ring-1 ring-white/5 ring-offset-0 hover:ring-blue-500/50 transition-all duration-500">
                      <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 to-purple-500/5"></div>
                      
                      {/* Browser Header Bar */}
                      <div className="h-12 border-b border-white/5 bg-white/5 flex items-center justify-between px-4 gap-2">
                          <div className="flex items-center gap-4">
                            <div className="flex gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500/20"></div>
                                <div className="w-3 h-3 rounded-full bg-yellow-500/20"></div>
                                <div className="w-3 h-3 rounded-full bg-green-500/20"></div>
                            </div>
                            <div className="px-3 py-1 rounded-md bg-white/5 text-xs text-slate-400 flex items-center gap-2">
                                <span className="text-slate-500">🔒</span> studysync.com/dashboard
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-slate-400 text-sm">
                            <Users size={16} />
                            <span>124 Online</span>
                          </div>
                      </div>

                      {/* Mock Dashboard Content */}
                      <div className="p-6 grid grid-cols-12 gap-6 h-full text-left bg-slate-950/30">
                          {/* Sidebar (Mock) */}
                          <div className="col-span-3 hidden md:flex flex-col gap-2 border-r border-white/5 pr-4">
                              <div className="h-8 w-full bg-blue-500/20 text-blue-300 rounded-md flex items-center px-3 text-sm font-medium gap-2">
                                <Hash size={16} /> Study Rooms
                              </div>
                              <div className="pl-4 flex flex-col gap-1">
                                <div className="h-7 w-full bg-white/5 text-slate-300 rounded-md flex items-center px-3 text-sm gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> # dsa-grind
                                </div>
                                <div className="h-7 w-full hover:bg-white/5 text-slate-400 rounded-md flex items-center px-3 text-sm gap-2 transition cursor-pointer">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span> # web-dev
                                </div>
                                <div className="h-7 w-full hover:bg-white/5 text-slate-400 rounded-md flex items-center px-3 text-sm gap-2 transition cursor-pointer">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span> # system-design
                                </div>
                              </div>

                              <div className="h-8 w-full hover:bg-white/5 text-slate-400 rounded-md flex items-center px-3 text-sm gap-2 transition mt-4 cursor-pointer">
                                <BarChart3 size={16} /> Analytics
                              </div>
                              <div className="h-8 w-full hover:bg-white/5 text-slate-400 rounded-md flex items-center px-3 text-sm gap-2 transition cursor-pointer">
                                <Trophy size={16} /> Leaderboard
                              </div>
                          </div>

                          {/* Chat Area (Mock) */}
                          <div className="col-span-12 md:col-span-6 flex flex-col justify-between gap-4 pb-2 h-full relative">
                              <div className="flex flex-col justify-end gap-4 h-full overflow-hidden">
                                  <div className="flex items-center justify-center gap-2 text-xs text-slate-500 my-2">
                                    <div className="h-px bg-white/10 w-12"></div>
                                    <span>Alex_dev joined the room</span>
                                    <div className="h-px bg-white/10 w-12"></div>
                                  </div>

                                  <div className="flex gap-3">
                                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-xs font-bold ring-2 ring-slate-900">JD</div>
                                      <div>
                                        <span className="text-purple-400 font-bold text-xs block mb-1 ml-1">@JohnDoe</span>
                                        <div className="bg-white/5 border border-white/5 p-3 rounded-2xl rounded-tl-none text-sm text-slate-300 shadow-sm backdrop-blur-md">
                                            Is the time complexity O(n) or O(log n) for this?
                                        </div>
                                      </div>
                                  </div>
                                  <div className="flex gap-3 flex-row-reverse">
                                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-xs font-bold ring-2 ring-slate-900">ME</div>
                                      <div className="bg-blue-600/80 p-3 rounded-2xl rounded-tr-none text-sm text-white shadow-md backdrop-blur-md">
                                          It's O(log n) because we are using binary search!
                                      </div>
                                  </div>
                                  <div className="flex gap-2 items-center text-xs text-slate-500 ml-11 animate-pulse">
                                    <span>Alex_dev is typing</span>
                                    <span className="flex gap-0.5">
                                      <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce"></span>
                                      <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce delay-75"></span>
                                      <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce delay-150"></span>
                                    </span>
                                  </div>
                              </div>
                              
                              <div className="mt-auto h-12 bg-white/5 border border-white/10 rounded-xl flex items-center px-4 text-sm text-slate-500">
                                Send a message to #dsa-grind...
                              </div>
                          </div>

                          {/* Stats (Mock) */}
                          <div className="col-span-3 hidden md:flex flex-col gap-4">
                              <div className="bg-white/5 p-4 rounded-xl border border-white/5 backdrop-blur-md relative overflow-hidden group/stat">
                                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover/stat:opacity-100 transition-opacity"></div>
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="text-xs text-slate-400">Focus Time</div>
                                    <Timer size={14} className="text-blue-400" />
                                  </div>
                                  <div className="text-2xl font-bold text-white">42m 10s</div>
                                  <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                                    <Zap size={12} className="text-yellow-500" /> +12% from yesterday
                                  </div>
                              </div>
                              
                              <div className="bg-white/5 p-4 rounded-xl border border-white/5 backdrop-blur-md relative overflow-hidden group/stat">
                                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent opacity-0 group-hover/stat:opacity-100 transition-opacity"></div>
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="text-xs text-slate-400">Current Streak</div>
                                    <Trophy size={14} className="text-green-400" />
                                  </div>
                                  <div className="text-2xl font-bold text-white">5 Days</div>
                                  <div className="w-full bg-white/10 h-1.5 rounded-full mt-3 overflow-hidden">
                                      <div className="bg-green-500 h-full rounded-full w-[80%]"></div>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              </FadeIn>
          </div>
        </section>

        {/* --- FEATURES GRID --- */}
        <section id="features" className="py-24 relative z-10">
          <div className="container mx-auto px-4">
              <FadeIn className="text-center mb-20" direction="up">
                  <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white drop-shadow-lg">Everything you need to <br/>ace the semester.</h2>
              </FadeIn>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {features.map((feature, index) => (
                      <FadeIn key={index} delay={index * 0.1} fullWidth direction="up">
                          <div className="relative h-full rounded-[1.25rem] md:rounded-[1.5rem] bg-white/5 p-1 transition-all duration-300 hover:bg-white/10 hover:shadow-2xl hover:shadow-blue-900/20">
                              <GlowingEffect
                                  blur={0}
                                  borderWidth={2}
                                  spread={30}
                                  glow={true}
                                  disabled={false}
                                  proximity={64}
                                  inactiveZone={0.01}
                                />
                              <div className="relative h-full bg-slate-900/20 backdrop-blur-md rounded-[1.1rem] border border-white/10 p-8 flex flex-col items-start overflow-hidden hover:border-white/20 transition-colors">
                                  <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-6 text-blue-400 border border-white/5">
                                      {feature.icon}
                                  </div>
                                  <h3 className="text-xl font-bold mb-3 text-slate-100">{feature.title}</h3>
                                  <p className="text-slate-300 leading-relaxed">
                                      {feature.desc}
                                  </p>
                              </div>
                          </div>
                      </FadeIn>
                  ))}
              </div>
          </div>
        </section>

        {/* --- AI POWERED WORKFLOW SECTION --- */}
        <section className="py-24 relative z-10 w-full overflow-hidden">
          {/* Subtle blend background instead of harsh lines */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0f172a]/40 to-transparent pointer-events-none blur-3xl"></div>
          
          <div className="container mx-auto px-4 relative z-10">
              <FadeIn className="text-center mb-16" direction="up">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/30 text-blue-300 text-sm mb-6 border border-blue-700/50 backdrop-blur-md">
                      <Sparkles size={16} className="text-blue-400" />
                      Powered by Advanced RAG
                  </div>
                  <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white drop-shadow-lg">Supercharge your learning<br/>with Artificial Intelligence.</h2>
                  <p className="text-lg text-slate-300 max-w-2xl mx-auto">
                    Take your raw context notes or textbooks and let our FastAPI reasoning engine generate tailored quizzes and summarize key concepts.
                  </p>
              </FadeIn>
              
              <FadeIn delay={0.2} direction="up" className="max-w-4xl mx-auto">
                <div className="relative rounded-3xl border border-white/5 bg-slate-900/30 backdrop-blur-xl p-8 md:p-12 shadow-2xl text-center group ring-1 ring-white/5">
                   <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/5 to-blue-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-3xl pointer-events-none"></div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                     <div className="flex flex-col items-center">
                       <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-4 text-blue-300 border border-blue-500/20">
                         <FolderOpen size={32} strokeWidth={1.5} />
                       </div>
                       <h3 className="font-bold text-white text-lg mb-2">1. Feed Context</h3>
                       <p className="text-slate-400 text-sm leading-relaxed">Provide your notes, PDFs, or code. The RAG pipeline processes it seamlessly.</p>
                     </div>
                     <div className="flex flex-col items-center relative">
                         {/* Connecting line for desktop view */}
                       <div className="hidden md:block absolute top-[2rem] -left-[50%] w-[100%] h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent"></div>
                       <div className="hidden md:block absolute top-[2rem] -right-[50%] w-[100%] h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent"></div>

                       <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-4 text-purple-300 border border-purple-500/20 relative bg-[#020617] z-10">
                         <ScanText size={32} strokeWidth={1.5} />
                       </div>
                       <h3 className="font-bold text-white text-lg mb-2">2. AI Analysis</h3>
                       <p className="text-slate-400 text-sm leading-relaxed">Our models extract core concepts, relationships, and weak spots immediately.</p>
                     </div>
                     <div className="flex flex-col items-center">
                       <div className="w-16 h-16 rounded-full bg-cyan-500/10 flex items-center justify-center mb-4 text-cyan-300 border border-cyan-500/20">
                         <Trophy size={32} strokeWidth={1.5} />
                       </div>
                       <h3 className="font-bold text-white text-lg mb-2">3. Start Quizzing</h3>
                       <p className="text-slate-400 text-sm leading-relaxed">Get real-time feedback, earn XP points, and dominate the global leaderboard.</p>
                     </div>
                   </div>
                </div>
              </FadeIn>
          </div>
        </section>

        {/* --- CTA SECTION --- */}
        <section className="py-32 relative">
            <div className="absolute inset-0 bg-white/5 backdrop-blur-sm pointer-events-none mask-gradient-to-b"></div>
            
            <div className="container mx-auto px-4 text-center relative z-10">
                <FadeIn direction="up">
                  <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white drop-shadow-xl">Ready to upgrade your grades?</h2>
                  <p className="text-slate-300 mb-10 max-w-xl mx-auto text-lg">
                      Join 1,000+ engineers who have switched from lonely study sessions to productive collaboration.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <Button 
                        size="lg" 
                        onClick={() => onOpenAuth('register')}
                        className="h-16 px-12 text-xl bg-white text-slate-950 hover:bg-slate-200 rounded-full font-bold shadow-2xl transition-transform active:scale-95"
                      >
                          Join StudySync Free
                      </Button>
                  </div>
                </FadeIn>
            </div>
        </section>

        <div className="pb-10">
            <Footer />
        </div>
        
      </div>
    </AuroraBackground>
  );
};

export default LandingPage;