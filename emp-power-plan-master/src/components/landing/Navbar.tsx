import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

const Navbar = () => {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  const handleGetStarted = () => {
    navigate('/register');
  };

  const handleLogin = () => {
    navigate('/login');
  };

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/80 backdrop-blur-md shadow-md' : 'bg-transparent'
      }`}
    >
      <div className="container mx-auto px-4 py-4 md:py-3 flex items-center justify-between">
        <div className="flex items-center">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="text-2xl font-bold font-heading"
          >
            <span className="text-primary">Task</span>
            <span className="text-accent">Sync</span>
          </motion.div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex gap-8 items-center">
          {['Features', 'Pricing', 'Testimonials', 'FAQ'].map((item) => (
            <motion.a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="font-medium text-foreground/80 hover:text-primary transition-colors"
              whileHover={{ scale: 1.05 }}
            >
              {item}
            </motion.a>
          ))}
          <Button onClick={handleLogin} variant="ghost" className="hover:text-primary">Log In</Button>
          <Button onClick={handleGetStarted} className="primary-button">Get Started</Button>
        </nav>

        {/* Mobile Menu Button */}
        <div className="md:hidden">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden bg-white/95 backdrop-blur-md"
        >
          <div className="container mx-auto px-4 py-4 flex flex-col gap-4">
            {['Features', 'Pricing', 'Testimonials', 'FAQ'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="font-medium text-foreground/80 hover:text-primary transition-colors py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item}
              </a>
            ))}
            <Button onClick={handleLogin} variant="ghost" className="w-full hover:text-primary">Log In</Button>
            <Button onClick={handleGetStarted} className="primary-button w-full">Get Started</Button>
          </div>
        </motion.div>
      )}
    </motion.header>
  );
};

export default Navbar; 