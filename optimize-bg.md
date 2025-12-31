# Background Image Optimization

The current bg.jpg is 11MB (6000x4000px), which is too large for mobile.

**Recommended:**
1. Compress the image to reduce file size:
   - Use tools like TinyPNG, Squoosh, or ImageOptim
   - Target size: < 500KB for mobile
   - Resolution: 1920x1280px or smaller (since it's at 20% opacity)

2. Or create a smaller version:
   - Resize to 1920x1280px
   - Compress quality to 60-70%
   - Save as bg-mobile.jpg

3. Consider using WebP format for better compression:
   - Convert to bg.webp
   - Update CSS to: background-image: url('bg.webp');
   - Add fallback: background-image: url('bg.jpg');
