"""Z natočených snímků (rec/<název>) udělá úsek s pevnými 30 fps: python3 mkclip.py <název> <od> <do> <výstup> [rychlost]"""
import json, os, shutil, subprocess, sys
name, a, b, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
speed = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0
ff = subprocess.check_output(['node', '-e', "console.log(require('ffmpeg-static'))"]).decode().strip()
frames = json.load(open(f'rec/{name}/frames.json'))['frames']
tmp = f'rec/{name}/_seq'
shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
n = int(round((b - a) / speed * 30)); j = 0
for i in range(n):
    t = a + i / 30 * speed
    while j + 1 < len(frames) and frames[j + 1]['t'] <= t: j += 1
    os.symlink(os.path.abspath(f"rec/{name}/{frames[j]['file']}"), f'{tmp}/s_{i:05d}.jpg')
subprocess.check_call([ff, '-y', '-loglevel', 'error', '-framerate', '30', '-i', f'{tmp}/s_%05d.jpg', '-c:v', 'libx264', '-g', '1', '-crf', '14', '-pix_fmt', 'yuv420p', '-an', out])
print(out, n, 'snímků')
