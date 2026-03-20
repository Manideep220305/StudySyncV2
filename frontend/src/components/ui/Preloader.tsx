import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Loader2, Laptop2, Server, Shield, Globe, Database } from 'lucide-react';

const Preloader = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  // Customized steps for StudySync
  const steps = [
    { label: 'Initializing Neural Core...', duration: 800, icon: Server },
    { label: 'Verifying Security Protocols...', duration: 1000, icon: Shield },
    { label: 'Syncing Global Study Rooms...', duration: 900, icon: Globe },
    { label: 'Loading User Assets...', duration: 700, icon: Database },
  ];

  useEffect(() => {
    let progressInterval;
    let stepTimeout;

    const totalDuration = steps.reduce((acc, step) => acc + step.duration, 0);
    const startTime = Date.now();

    // 1. Smooth Progress Bar Logic
    progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / totalDuration) * 100, 100);
      setProgress(newProgress);

      if (newProgress >= 100) {
        clearInterval(progressInterval);
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 600); // Slight delay at 100% before unmounting
      }
    }, 20); // Faster updates for smoother bar

    // 2. Step Switching Logic
    const scheduleSteps = () => {
      let cumulativeDuration = 0;
      steps.forEach((step, index) => {
        cumulativeDuration += step.duration;
        stepTimeout = setTimeout(() => {
          setCurrentStep(index + 1);
        }, cumulativeDuration);
      });
    };

    scheduleSteps();

    return () => {
      clearInterval(progressInterval);
      if (stepTimeout) clearTimeout(stepTimeout);
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }} // Cyber exit animation
      transition={{ duration: 0.8, ease: "easeInOut" }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#020617] text-white overflow-hidden"
    >
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-cyan-600/10 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5"></div>
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        
        {/* Header / Logo */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-10 text-center"
        >
          <div className="inline-flex items-center justify-center p-3 mb-4 rounded-xl bg-blue-500/10 border border-blue-500/20 ring-1 ring-blue-500/10 shadow-[0_0_40px_-10px_rgba(59,130,246,0.3)]">
            <Laptop2 className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-blue-200 to-slate-400 bg-clip-text text-transparent">
            StudySync v2.0
          </h1>
          <p className="text-slate-500 text-sm mt-2 font-mono tracking-wide">
            ESTABLISHING SECURE CONNECTION
          </p>
        </motion.div>

        {/* Progress Bar */}
        <div className="relative h-1.5 bg-slate-800/50 rounded-full overflow-hidden mb-10 ring-1 ring-white/5">
          <motion.div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ ease: "linear", duration: 0.1 }}
          />
          {/* Animated Glow on the tip of the bar */}
          <motion.div 
             className="absolute top-0 h-full w-20 bg-white/30 blur-md"
             style={{ left: `${progress}%`, translateX: '-50%' }}
          />
        </div>

        {/* Steps List */}
        <div className="space-y-4 font-mono text-sm">
          {steps.map((step, index) => {
             const Icon = step.icon;
             const status = currentStep > index ? 'completed' : currentStep === index ? 'current' : 'pending';
             
             return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-center gap-4 p-3 rounded-lg border transition-all duration-300 ${
                  status === 'current' 
                    ? 'bg-blue-900/10 border-blue-500/30 shadow-[0_0_15px_-5px_rgba(59,130,246,0.2)]' 
                    : 'bg-transparent border-transparent'
                }`}
              >
                {/* Status Icon */}
                <div className="flex-shrink-0">
                  {status === 'completed' ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : status === 'current' ? (
                    <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-slate-700 bg-slate-800/50" />
                  )}
                </div>

                {/* Label */}
                <div className="flex-1">
                   <span className={`transition-colors ${
                     status === 'completed' ? 'text-slate-400' : 
                     status === 'current' ? 'text-blue-200' : 'text-slate-600'
                   }`}>
                     {step.label}
                   </span>
                </div>

                {/* Type Icon (Decorative) */}
                <Icon className={`w-4 h-4 transition-colors ${
                    status === 'current' ? 'text-blue-400' : 'text-slate-700'
                }`} />
              </motion.div>
             );
          })}
        </div>

        {/* Percentage Counter */}
        <div className="mt-8 text-center">
            <span className="font-mono text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-500">
                {Math.round(progress)}%
            </span>
        </div>

      </div>
    </motion.div>
  );
};

export default Preloader;