import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import FloatingCubes from './FloatingCubes';
import MockupUI from './MockupUI';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-purple-50 dark:from-background dark:to-purple-950/20 relative overflow-hidden">
      {/* Background gradient circles */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-200/30 dark:bg-purple-900/20 rounded-full blur-3xl" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-200/30 dark:bg-blue-900/20 rounded-full blur-3xl" />
      </div>

      {/* 3D Floating Cubes */}
      <FloatingCubes />

      {/* Animated Mockup UI */}
      <MockupUI />

      {/* Main content */}
      <div className="container mx-auto px-4 pt-20 relative z-10">
        <nav className="flex justify-between items-center mb-16">
          <div className="text-2xl font-bold gradient-text">TaskSync</div>
          <div className="space-x-4">
            <Button variant="ghost" onClick={() => navigate('/login')} 
                    className="hover:scale-105 transition-transform">
              Log in
            </Button>
            <Button onClick={() => navigate('/signup')} 
                    className="primary-button hover:scale-105 transition-transform">
              Get Started
            </Button>
          </div>
        </nav>

        <div className="max-w-3xl mx-auto text-center">
          <div className="space-y-6">
            <h1 className="text-6xl font-bold hero-text-animation">
              <span className="gradient-text">Manage Tasks,</span>
              <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                Empower Teams
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground hero-description-animation">
              TaskSync brings your teams and work together in one shared space. 
              Streamline processes, create clear accountability, and accelerate 
              your team's achievements.
            </p>

            <div className="flex justify-center gap-4 hero-button-animation">
              <Button onClick={() => navigate('/signup')} size="lg" 
                      className="primary-button hover:scale-105 transition-transform">
                Get Started Free
              </Button>
              <Button onClick={() => navigate('/demo')} size="lg" variant="outline"
                      className="hover:scale-105 transition-transform">
                Watch Demo
              </Button>
            </div>

            <p className="text-sm text-muted-foreground mt-8 hero-description-animation">
              Trusted by 10,000+ teams worldwide
            </p>
          </div>

          {/* Feature cards */}
          <div className="grid md:grid-cols-3 gap-8 mt-20">
            <div className="glass-card p-6 text-left transform transition-all duration-300 hover:scale-105">
              <h3 className="text-xl font-semibold mb-2 gradient-text">Task Management</h3>
              <p className="text-muted-foreground">
                Create, assign, and track tasks with ease. Set priorities and deadlines.
              </p>
            </div>
            <div className="glass-card p-6 text-left transform transition-all duration-300 hover:scale-105">
              <h3 className="text-xl font-semibold mb-2 gradient-text">Team Collaboration</h3>
              <p className="text-muted-foreground">
                Work together seamlessly with real-time updates and notifications.
              </p>
            </div>
            <div className="glass-card p-6 text-left transform transition-all duration-300 hover:scale-105">
              <h3 className="text-xl font-semibold mb-2 gradient-text">Performance Tracking</h3>
              <p className="text-muted-foreground">
                Monitor progress and measure team productivity with detailed analytics.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage; 