// Türkiye ve Dünya Canlı Ekonomi Haberleri Servisi (RSS + Full Article Scraper)

export function decodeAllHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ccedil;/gi, 'ç')
    .replace(/&Ccedil;/g, 'Ç')
    .replace(/&ouml;/gi, 'ö')
    .replace(/&Ouml;/g, 'Ö')
    .replace(/&uuml;/gi, 'ü')
    .replace(/&Uuml;/g, 'Ü')
    .replace(/&iuml;/gi, 'ï')
    .replace(/&Iuml;/g, 'Ï')
    .replace(/&icirc;/gi, 'î')
    .replace(/&Icirc;/g, 'Î')
    .replace(/&acirc;/gi, 'â')
    .replace(/&Acirc;/g, 'Â')
    .replace(/&ucirc;/gi, 'û')
    .replace(/&Ucirc;/g, 'Û')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&hellip;/g, '...')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '—')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .trim();
}

export function cleanParagraph(text) {
  if (!text) return '';
  let cleaned = text
    .replace(/<!\[CDATA\[/gi, '')
    .replace(/\]\]>/gi, '')
    .replace(/<[^>]+>/g, ' ');
  cleaned = decodeAllHtmlEntities(cleaned);
  cleaned = cleaned
    .replace(/<!\[CDATA\[/gi, '')
    .replace(/\]\]>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned;
}

export function formatTimeAgo(dateString) {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.round(diffMs / (1000 * 60));

    if (diffMin < 1) return 'Az önce';
    if (diffMin < 60) return `${diffMin} dk önce`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} saat önce`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Dün';
    if (diffDays < 7) return `${diffDays} gün önce`;

    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  } catch (e) {
    return '';
  }
}

export function formatFullNewsDate(dateString) {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return '';
  }
}

export function getNewsHourLabel(dateString) {
  if (!dateString) return 'Günün Haberleri';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'Günün Haberleri';

    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    const hours = String(d.getHours()).padStart(2, '0');
    const timeLabel = `${hours}:00`;

    if (isToday) {
      return timeLabel;
    }

    if (isYesterday) {
      return `Dün • ${timeLabel}`;
    }

    const dayMonth = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    return `${dayMonth} • ${timeLabel}`;
  } catch (e) {
    return 'Günün Haberleri';
  }
}

function extractImageUrl(raw) {
  if (!raw) return null;

  // 1. <enclosure url="..." />
  const encTag = raw.match(/<enclosure[^>]+url=["'](https?:\/\/[^"'\s]+)["']/i);
  if (encTag && encTag[1] && !encTag[1].includes('geoim.bloomberght.com')) {
    return encTag[1].trim();
  }

  // 2. <media:content url="..." />
  const mediaTag = raw.match(/<media:content[^>]+url=["'](https?:\/\/[^"'\s]+)["']/i);
  if (mediaTag && mediaTag[1]) {
    return mediaTag[1].trim();
  }

  // 3. <img src="..." />
  const htmlImgTag = raw.match(/<img[^>]+src=["'](https?:\/\/[^"'\s]+)["']/i);
  if (htmlImgTag && htmlImgTag[1]) {
    return htmlImgTag[1].trim();
  }

  // 4. <image> tag
  const imgTag = raw.match(/<image>(?:<!\[CDATA\[)?(https?:\/\/[^\]<>\s"']+)(?:\]\]>)?<\/image>/i);
  if (imgTag && imgTag[1] && !imgTag[1].includes('logo') && !imgTag[1].includes('geoim.bloomberght.com')) {
    return imgTag[1].trim();
  }

  return null;
}

// 1. Tüm Canlı Ekonomi Haberlerini Çek (TRT Haber, Dünya Gazetesi, Habertürk)
export async function fetchAllEconomyNews() {
  const newsList = [];
  const seenTitles = new Set();

  const feeds = [
    {
      source: 'TRT Haber',
      url: 'https://www.trthaber.com/ekonomi_articles.rss'
    },
    {
      source: 'Dünya Gazetesi',
      url: 'https://www.dunya.com/rss'
    },
    {
      source: 'Habertürk',
      url: 'https://www.haberturk.com/rss/kategori/ekonomi.xml'
    }
  ];

  await Promise.allSettled(
    feeds.map(async (feed) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const response = await fetch(feed.url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const text = await response.text();
          const rawItems = text.split('<item>').slice(1);

          for (const raw of rawItems) {
            const tm = raw.match(/<title\b[^>]*>(.*?)<\/title>/is);
            const dm = raw.match(/<description\b[^>]*>(.*?)<\/description>/is);
            const lm = raw.match(/<link\b[^>]*>(.*?)<\/link>/is) || raw.match(/<guid\b[^>]*>(.*?)<\/guid>/is);
            const pm = raw.match(/<pubDate\b[^>]*>(.*?)<\/pubDate>/is);
            const imageUrl = extractImageUrl(raw);

            if (tm && lm) {
              const title = cleanParagraph(tm[1]);
              const link = lm[1].replace(/<!\[CDATA\[|\]\]>/gi, '').replace(/<[^>]+>/g, '').trim();
              const cleanDesc = dm ? cleanParagraph(dm[1]) : '';
              const pubDate = pm ? pm[1].replace(/<!\[CDATA\[|\]\]>/gi, '').replace(/<[^>]+>/g, '').trim() : '';

              // Spor haberlerini filtrele
              if (link.includes('/spor/')) continue;

              const normTitle = title.toLowerCase().replace(/[^a-z0-9ğüşıöç]/gi, '').slice(0, 30);

              if (normTitle.length > 5 && !seenTitles.has(normTitle)) {
                seenTitles.add(normTitle);
                newsList.push({
                  id: link || `${feed.source}-${newsList.length}`,
                  title,
                  description: cleanDesc,
                  imageUrl,
                  link,
                  pubDate,
                  dateObj: pubDate ? new Date(pubDate).getTime() : 0,
                  timeAgo: formatTimeAgo(pubDate),
                  fullDate: formatFullNewsDate(pubDate),
                  source: feed.source
                });
              }
            }
          }
        }
      } catch (err) {
        console.log(`${feed.source} RSS çekilemedi:`, err.message);
      }
    })
  );

  // Tarihe göre en yeniden eskiye sırala
  newsList.sort((a, b) => b.dateObj - a.dateObj);
  return newsList;
}

// 2. Haberin Tam Metnini ve Paragraflarını Çek (Okuma Modu)
export async function fetchFullArticle(url) {
  if (!url) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6500);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const rawHtml = await res.text();

    // Gereksiz tagları temizle
    const cleanHtml = rawHtml
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
      .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '');

    // 1. Özet / Spot
    let lead = '';
    const spotMatch = cleanHtml.match(/<(?:div|p|h2|span)[^>]+class=["'][^"']*(?:news-spot|spot|lead|summary|excerpt|article-lead|detail-lead|post-summary)[^"']*["'][^>]*>(.*?)<\/(?:div|p|h2|span)>/is);
    if (spotMatch) {
      lead = cleanParagraph(spotMatch[1]);
    }
    if (!lead || lead.length < 25) {
      const metaDesc = cleanHtml.match(/<meta[^>]+(?:name|property)=["'](?:og:description|description)["'][^>]+content=["'](.*?)["']/is);
      if (metaDesc) {
        const cleanedMeta = cleanParagraph(metaDesc[1]);
        if (cleanedMeta.length > lead.length) {
          lead = cleanedMeta;
        }
      }
    }

    // 2. Yüksek Çözünürlüklü Kapak Görseli
    let heroImage = '';
    const ogImg = cleanHtml.match(/<meta[^>]+property=["']og:image["'][^>]+content=["'](.*?)["']/is);
    if (ogImg) {
      heroImage = ogImg[1].trim();
    }

    // 3. Paragrafları ve Ara Başlıkları Çıkar
    const paragraphs = [];
    const blockRegex = /<(p|h2|h3|h4|h5)\b([^>]*)>(.*?)<\/\1>/gis;
    let match;
    const ignoreKeywords = [
      'abone ol', 'tıklayın', 'tıklayınız', 'fotoğraf:', 'fotoğraflar:', 'foto:',
      'kaynak:', 'copyright', 'tüm hakları', 'whatsapp kanalımız', 'telegram kanalımız',
      'takip edin', 'bizi takip', 'çerez', 'cookie', 'günün özeti', 'günün önemli',
      'reklam', 'haber bülteni', 'e-posta adresiniz', 'kaydol', 'üye ol', 'kaynakça',
      'paylaş', 'yorumlar', 'benzer haberler', 'ilginizi çekebilir', 'çok okunanlar',
      'gündemdeki haberler', 'video galeri', 'foto galeri'
    ];

    const seenTexts = new Set();
    if (lead) {
      seenTexts.add(lead.toLowerCase().slice(0, 40));
    }

    let isFirstH2 = true;

    while ((match = blockRegex.exec(cleanHtml)) !== null) {
      const tag = match[1].toLowerCase();
      const attrs = match[2];
      const rawInner = match[3];
      const cleanText = cleanParagraph(rawInner);

      if (cleanText.length < 4) continue;

      const lower = cleanText.toLowerCase();
      if (ignoreKeywords.some(kw => lower.includes(kw))) continue;

      const prefixKey = lower.slice(0, 40);
      if (seenTexts.has(prefixKey)) continue;

      // İlk H2 tagı bazen haberin spot/özeti olabiliyor
      const isSpotAttr = attrs.includes('spot') || attrs.includes('lead') || attrs.includes('summary') || attrs.includes('post-summary');
      if (tag === 'h2' && isFirstH2) {
        isFirstH2 = false;
        if (isSpotAttr || (lead && cleanText.startsWith(lead.slice(0, 30))) || (!lead && cleanText.length > 35)) {
          if (!lead) lead = cleanText;
          seenTexts.add(prefixKey);
          continue;
        }
      }

      const isHeadingTag = tag.startsWith('h');
      const isStrongP = tag === 'p' && /^\s*<(?:strong|b)\b[^>]*>.*<\/(?:strong|b)>\s*$/is.test(rawInner) && cleanText.length <= 160;

      const type = (isHeadingTag || isStrongP) ? 'heading' : 'paragraph';

      if (type === 'paragraph' && cleanText.length < 20) continue;

      seenTexts.add(prefixKey);
      paragraphs.push({
        type,
        text: cleanText
      });
    }

    return {
      lead,
      paragraphs,
      heroImage
    };
  } catch (err) {
    console.log('Haber metni çekilemedi:', err.message);
    return null;
  }
}
