import { motion } from 'framer-motion';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="pt-16 pb-8 border-t border-border/50">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="text-2xl font-bold font-heading mb-4"
            >
              <span className="text-primary">Task</span>
              <span className="text-accent">Sync</span>
            </motion.div>
            
            <p className="text-foreground/70 mb-4">
              Empower your team with our intuitive and powerful task management platform.
            </p>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Product</h4>
            <ul className="space-y-2">
              {['Features', 'Pricing', 'Integrations', 'Roadmap', 'Updates'].map((item) => (
                <li key={item}>
                  <a href="#" className="text-foreground/70 hover:text-primary transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Company</h4>
            <ul className="space-y-2">
              {['About Us', 'Careers', 'Blog', 'Press', 'Contact'].map((item) => (
                <li key={item}>
                  <a href="#" className="text-foreground/70 hover:text-primary transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Resources</h4>
            <ul className="space-y-2">
              {['Documentation', 'Help Center', 'Guides', 'API', 'Community'].map((item) => (
                <li key={item}>
                  <a href="#" className="text-foreground/70 hover:text-primary transition-colors">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        <div className="border-t border-border/50 pt-6 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-foreground/60 mb-4 md:mb-0">
            © {currentYear} TaskSync. All rights reserved.
          </p>
          
          <div className="flex gap-4">
            {['Terms', 'Privacy', 'Cookies'].map((item) => (
              <a 
                key={item} 
                href="#" 
                className="text-sm text-foreground/60 hover:text-primary transition-colors"
              >
                {item}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 