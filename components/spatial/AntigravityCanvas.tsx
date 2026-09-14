'use client';

import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

export function AntigravityCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: Particle[] = [];
    let animationFrameId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;
    
    // Mouse state
    const mouse = { x: -1000, y: -1000 };

    const init = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;

      particles = [];
      const numParticles = Math.min(80, Math.floor((width * height) / 18000));

      const colors = ['rgba(0, 240, 255, 0.7)', 'rgba(140, 239, 255, 0.5)', 'rgba(168, 85, 247, 0.6)'];

      for (let i = 0; i < numParticles; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          radius: Math.random() * 1.5 + 0.5,
          color: colors[Math.floor(Math.random() * colors.length)]
        });
      }
    };

    const draw = () => {
      // Clear with deep dark transparent for trailing effect
      ctx.fillStyle = 'rgba(3, 6, 13, 0.25)';
      ctx.fillRect(0, 0, width, height);

      // Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        
        // Anti-gravity float
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Mouse interaction (Repel and connect)
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const distanceToMouse = Math.sqrt(dx * dx + dy * dy);
        
        if (distanceToMouse < 140) {
          p.x -= dx * 0.01;
          p.y -= dy * 0.01;
          
          // Draw beam to mouse
          ctx.beginPath();
          ctx.strokeStyle = `rgba(0, 240, 255, ${Math.max(0, 1 - distanceToMouse / 140) * 0.6})`;
          ctx.lineWidth = 0.6;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }

        // Draw node
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

        // Connect nearby nodes (Constellation effect)
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx2 = p.x - p2.x;
          const dy2 = p.y - p2.y;
          const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

          if (dist2 < 95) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0, 240, 255, ${0.12 * (1 - dist2 / 95)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    
    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    window.addEventListener('resize', init);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    init();
    draw();

    return () => {
      window.removeEventListener('resize', init);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1, opacity: 0.7 }}
    />
  );
}
