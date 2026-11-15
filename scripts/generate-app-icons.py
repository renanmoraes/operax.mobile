#!/usr/bin/env python3
"""Gera os ícones do app (iPhone, Android adaptativo, notificação, abertura e favicon)
a partir da marca Operax redesenhada em geometria. Uso: python3 scripts/generate-app-icons.py"""
from PIL import Image, ImageDraw
import numpy as np

BOX = (296.0, 292.0)
CX, CY, R_OUT, R_IN = 147.5, 146.0, 147.75, 100.7
CHEVRON = [(123, 94), (178, 94), (236.1, 157.2), (131.6, 291.6), (86.1, 276.0), (181.6, 158.2)]

def right_cut(y):  # x da reta do corte direito do anel
    return 240 + 0.769 * (y - 206)

def left_cut(y):  # x da reta do corte esquerdo (paralela à haste de baixo da seta)
    return 101 - 0.794 * (y - 234)

def mark_alpha(size):
    """Alfa da marca num quadrado de `size` px (marca centralizada, proporção original)."""
    ss = 4
    S = size * ss
    scale = S / max(BOX)
    ox = (S - BOX[0] * scale) / 2
    oy = (S - BOX[1] * scale) / 2
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    X = (xx + 0.5 - ox) / scale
    Y = (yy + 0.5 - oy) / scale
    d = np.hypot(X - CX, Y - CY)
    ring = (d <= R_OUT) & (d >= R_IN)
    gap = (Y > CY) & (X > left_cut(Y)) & (X < right_cut(Y))
    ring &= ~gap
    img = Image.new('L', (S, S), 0)
    ImageDraw.Draw(img).polygon([(ox + x * scale, oy + y * scale) for x, y in CHEVRON], fill=255)
    chev = np.array(img) > 127
    m = (ring | chev).astype(np.uint8) * 255
    return Image.fromarray(m, 'L').resize((size, size), Image.LANCZOS)

def gradient(size, top=(0, 214, 255), bottom=(0, 56, 196)):
    """Degradê da marca: claro no alto à direita, escuro embaixo à esquerda."""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) / size
    d = np.array([0.296, -0.955])
    t = (xx - 0.5) * d[0] + (yy - 0.5) * d[1]
    t = (t - t.min()) / (t.max() - t.min())  # 0 = embaixo/esquerda, 1 = alto/direita
    t = t ** 0.9
    c = np.zeros((size, size, 3), np.float32)
    for i in range(3):
        c[:, :, i] = bottom[i] + (top[i] - bottom[i]) * t
    return Image.fromarray(c.clip(0, 255).astype(np.uint8), 'RGB')

def mark_rgba(size):
    m = gradient(size).convert('RGBA')
    m.putalpha(mark_alpha(size))
    return m

# ---------------------------------------------------------------- ícones

import os

NAVY_DEEP = (5, 10, 20)       # #050a14, o mesmo fundo da abertura do app
NAVY_LIFT = (14, 30, 66)      # brilho do centro, puxado para o azul da marca
GLOW = (0, 132, 255)


def background(size, glow=True):
    """Fundo azul-marinho com luz suave no centro (alto) e brilho azul atrás da marca."""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) / size
    d = np.hypot(xx - 0.5, (yy - 0.44) * 1.05)
    t = np.clip(d / 0.78, 0, 1) ** 1.35
    c = np.zeros((size, size, 3), np.float32)
    for i in range(3):
        c[:, :, i] = NAVY_LIFT[i] + (NAVY_DEEP[i] - NAVY_LIFT[i]) * t
    if glow:
        g = np.exp(-((xx - 0.52) ** 2 + (yy - 0.47) ** 2) / (2 * 0.17 ** 2)) * 0.22
        for i in range(3):
            c[:, :, i] = c[:, :, i] * (1 - g) + GLOW[i] * g
    return Image.fromarray(c.clip(0, 255).astype(np.uint8), 'RGB')


def place(canvas, mark_size, dy=0.0):
    m = mark_rgba(mark_size)
    x = (canvas.width - mark_size) // 2
    y = (canvas.height - mark_size) // 2 + int(dy * canvas.height)
    canvas.alpha_composite(m, (x, y))
    return canvas


def white(size, mark_size):
    out = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    a = Image.new('L', (size, size), 0)
    a.paste(mark_alpha(mark_size), ((size - mark_size) // 2, (size - mark_size) // 2))
    out.putalpha(a)
    return out


def main():
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets')
    img = lambda n: os.path.join(root, 'images', n)

    # iPhone/App Store: 1024 opaco (o sistema arredonda os cantos). Marca ocupa ~60%.
    ios = background(1024).convert('RGBA')
    place(ios, 612)
    ios.convert('RGB').save(img('icon.png'))

    # Android adaptativo: fundo de ponta a ponta + marca na zona segura (66% central).
    background(1024).save(img('android-icon-background.png'))
    fg = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    place(fg, 560)
    fg.save(img('android-icon-foreground.png'))
    # Tema do sistema (Android 13+): silhueta que o sistema pinta.
    white(1024, 560).save(img('android-icon-monochrome.png'))

    # Notificação no Android: silhueta branca (o sistema aplica a cor do app).
    white(96, 80).save(img('notification-icon.png'))

    # Abertura do app: marca nítida sobre o fundo #050a14 da tela de abertura.
    splash = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    place(splash, 1024)
    splash.save(img('splash-icon.png'))

    # Favicon (versão web) com o mesmo fundo.
    fav = background(192).convert('RGBA')
    place(fav, 118)
    fav.resize((48, 48), Image.LANCZOS).convert('RGB').save(img('favicon.png'))

    # Marca usada dentro do app (abertura animada e carregando): 3x mais nítida, mesma proporção.
    w, h = int(BOX[0] * 3), int(BOX[1] * 3)
    sq = mark_rgba(w)
    sq.crop((0, (w - h) // 2, w, (w - h) // 2 + h)).save(os.path.join(root, 'brand', 'operax-mark.png'))
    print('ícones gerados em assets/images e assets/brand/operax-mark.png')


if __name__ == '__main__':
    main()
