import { motion } from 'framer-motion';
import { CheckCircle, Calendar, Users, Clock, Edit, List } from 'lucide-react';

const features = [
  {
    icon: <List className="w-10 h-10 text-primary" />,
    title: 'Task Management',
    description: 'Create, assign, and track tasks with ease. Set priorities, deadlines, and dependencies.'
  },
  {
    icon: <Users className="w-10 h-10 text-primary" />,
    title: 'Team Collaboration',
    description: 'Improve team communication with comments, file sharing, and @mentions in tasks.'
  },
  {
    icon: <Calendar className="w-10 h-10 text-primary" />,
    title: 'Project Planning',
    description: 'Visualize projects with Gantt charts, Kanban boards, and custom calendar views.'
  },
  {
    icon: <Clock className="w-10 h-10 text-primary" />,
    title: 'Time Tracking',
    description: 'Monitor work hours, track time spent on tasks, and analyze productivity patterns.'
  },
  {
    icon: <CheckCircle className="w-10 h-10 text-primary" />,
    title: 'Progress Tracking',
    description: 'Set milestones, track completion rates, and celebrate team achievements.'
  },
  {
    icon: <Edit className="w-10 h-10 text-primary" />,
    title: 'Custom Workflows',
    description: 'Create customized workflows that adapt to your team\'s unique processes.'
  }
];

const FeatureCard = ({ feature, index }: { feature: typeof features[0], index: number }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: index * 0.1 }}
      viewport={{ once: true, margin: "-50px" }}
      className="glass-card p-6 h-full"
    >
      <div className="p-3 bg-primary/10 rounded-full w-fit mb-4">
        {feature.icon}
      </div>
      <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
      <p className="text-foreground/75">{feature.description}</p>
    </motion.div>
  );
};

const FeaturesSection = () => {
  return (
    <section id="features" className="py-20 md:py-28 relative">
      <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-background to-transparent" />
      
      <div className="container mx-auto px-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Powerful Features for <span className="gradient-text">Productive Teams</span></h2>
          <p className="text-foreground/75 max-w-2xl mx-auto">
            TaskSync offers a comprehensive suite of tools to help your team stay organized,
            collaborate effectively, and deliver projects on time.
          </p>
        </motion.div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <FeatureCard key={index} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection; 