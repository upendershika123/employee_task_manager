import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";

const HeroSection = () => {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate('/register');
  };

  const handleWatchDemo = () => {
    // You can implement demo video functionality here
    window.open('https://www.youtube.com/watch?v=demo', '_blank');
  };

  return (
    <section className="min-h-screen pt-20 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-radial from-accent/10 to-transparent -z-10" />
      
      <div className="container mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-8 h-full items-center py-16 md:py-20">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center lg:text-left"
        >
          <motion.span 
            className="inline-block px-4 py-1.5 mb-4 bg-accent/10 text-accent rounded-full font-medium text-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            Revolutionize your workflow
          </motion.span>
          
          <motion.h1 
            className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            Manage Tasks, 
            <span className="gradient-text"> Empower Teams</span>
          </motion.h1>
          
          <motion.p 
            className="text-lg text-foreground/80 mb-8 max-w-lg mx-auto lg:mx-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            TaskSync brings your teams and work together in one shared space. Streamline processes, 
            create clear accountability, and accelerate your team's achievements.
          </motion.p>
          
          <motion.div 
            className="flex flex-wrap gap-4 justify-center lg:justify-start"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
          >
            <Button onClick={handleGetStarted} className="primary-button">Get Started Free</Button>
            <Button onClick={handleWatchDemo} className="secondary-button">Watch Demo</Button>
          </motion.div>
          
          <motion.div 
            className="mt-10 flex items-center gap-4 justify-center lg:justify-start"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.8 }}
          >
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-gray-300 border-2 border-white" />
              ))}
            </div>
            <p className="text-sm text-foreground/70">
              Trusted by <span className="font-semibold">10,000+</span> teams worldwide
            </p>
          </motion.div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
          className="h-[400px] md:h-[500px] w-full relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-lg" />
          <div className="absolute inset-0 flex items-center justify-center">
            <img 
              src="/images/dashboard-preview.svg" 
              alt="Dashboard Preview" 
              className="w-full h-full object-cover rounded-lg shadow-xl"
            />
          </div>
        </motion.div>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default HeroSection;