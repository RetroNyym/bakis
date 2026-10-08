# BAKIS — Baktığın büyür, bakmadığın avlanır

> **EN:** BAKIS — a short browser puzzle-arcade game. Whatever you keep your
> light on grows; what you ignore comes for you. HTML5 canvas, 8 levels,
> zero dependencies.

**BAKIŞ**, tek ekranlık bir bulmaca/arcade oyunudur: karanlık bir ızgarada
ışığını yönetir, kristalleri toplar ve çıkışa ulaşmaya çalışırsın. Işığın
tuttuğu her şey büyür, ışıktan mahrum kalan her şey sana doğru süzülür —
ne çok uzun bak ne de hiç bakma.

## Oynanış

- **Fare / dokunmatik** ile ışığı yönlendir (ışık yarıçapı sabit, hız sabit)
- Kristalleri **ışıkla besle**, büyümelerini sağla ve topla
- Düşmanlar ışığa girince yavaşlar, girmezse seni avlar
- 8 hazır seviye: *İlk Bakış · Ara Verme · Sütunlar · Köşe · ...*
- İlerleme `localStorage`'a kaydedilir (`bakis_progress_v1`), kaldığın yerden devam

## Kurulum

Kurulum yok — **çift tıkla**:

```
index.html
```

tarayıcıda açılır. Dileyene yerel sunucu:

```bash
python -m http.server 8080   # sonra http://localhost:8080
```

## Teknik

- Saf **HTML5 canvas + JavaScript** (vanilla, framework/bağımlılık yok)
- 960×528 sahne, 20×11 karo, mobil dokunmatik destekli
- `smoke.js` hızlı duman testi · `BAKIS-itchio.zip` itch.io paketi

## Lisans

Depodaki `LICENSE` dosyasına bakınız.
