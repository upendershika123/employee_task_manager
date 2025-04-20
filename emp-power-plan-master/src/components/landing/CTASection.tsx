import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const CTASection = () => {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate('/register');
  };

  const handleScheduleDemo = () => {
    // You can implement demo scheduling functionality here
    window.open('mailto:contact@tasksync.com?subject=Schedule Demo Request', '_blank');
  };

  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 -z-10" />
      
      <div className="container mx-auto px-4">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="glass-card p-8 md:p-12 text-center max-w-4xl mx-auto"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to <span className="gradient-text">Transform</span> Your Team's Productivity?
          </h2>
          
          <p className="text-lg text-foreground/80 mb-8 max-w-2xl mx-auto">
            Join thousands of teams that use TaskSync to streamline their workflow,
            improve collaboration, and deliver projects on time.
          </p>
          
          <div className="flex flex-wrap gap-4 justify-center">
            <Button onClick={handleGetStarted} className="primary-button">Start Free Trial</Button>
            <Button onClick={handleScheduleDemo} className="secondary-button">Schedule Demo</Button>
          </div>
          
          <p className="mt-6 text-sm text-foreground/60">
            No credit card required. Free 14-day trial.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection; 