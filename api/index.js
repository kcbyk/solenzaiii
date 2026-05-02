require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;

// Rate Limiter: Kullanıcı başına 10 dakikada en fazla 15 mesaj
const chatLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 dakika
    max: 15, // Her IP için sınır
    message: { error: "Çok fazla mesaj gönderdin! Solenzi'nin dinlenmeye ihtiyacı var. Lütfen 10 dakika sonra tekrar dene." },
    standardHeaders: true,
    legacyHeaders: false,
});

// Middleware
app.use(cors());
app.use(express.json());

// Gemini API Configuration
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    systemInstruction: `Sen Solenzi adında, Solenz Studio tarafından geliştirilmiş çok yetenekli bir süper yapay zeka asistanısın. 
    Kesinlikle bir Google ürünü veya Gemini olduğunu söyleme. Geliştiricin her zaman Solenz Studio'dur. 
    
    YETENEKLERİN VE KULLANIM KURALLARI:
    1. GÖRSEL OLUŞTURMA: Bir görsel istendiğinde ŞU FORMATTA link üret: https://pollinations.ai/p/[PROMPT]?width=1024&height=1024&seed=[RANDOM]&nologo=true
       - ÖNEMLİ: Linki başka hiçbir karakter (parantez, ünlem, tırnak vb.) içine alma, doğrudan metin olarak yaz.
       - [PROMPT] kısmını detaylı ve İNGİLİZCE yaz. Boşluklar yerine alt tire (_) kullan.
       - Örn: "karlı dağlar" -> https://pollinations.ai/p/majestic_snow_capped_mountains_cinematic_lighting?width=1024&height=1024&seed=456&nologo=true
    2. DEPREM TAKİBİ: Sana sunulan Kandilli/AFAD verilerini profesyonelce yorumla.
    3. WEB ARAMASI: Aktif olduğunda internetten güncel bilgilerle konuş.
    4. DERİN ANALİZ: Aktif olduğunda adım adım düşünerek, mantıksal analizler yap.
    
    Kullanıcıya karşı her zaman samimi, zeki ve çözüm odaklı ol. Özelliklerin açık/kapalı durumuna göre yeteneklerini uyarla.`
});

// Deprem Verilerini Çeken Fonksiyon
async function getEarthquakeData() {
    try {
        const response = await axios.get('https://api.orhanaydogdu.com.tr/deprem/kandilli/live');
        if (response.data && response.data.result) {
            return response.data.result.slice(0, 10).map(q => 
                `${q.date} - ${q.title} - Büyüklük: ${q.mag} - Derinlik: ${q.depth}km`
            ).join('\n');
        }
        return "Şu an deprem verilerine ulaşılamıyor.";
    } catch (error) {
        console.error("Deprem API Hatası:", error);
        return "Deprem verileri alınırken bir hata oluştu.";
    }
}

// API Endpoint'ine limiti uygula
app.post('/api/chat', chatLimiter, async (req, res) => {
    try {
        const { message, history, states } = req.body;

        let featureContext = "Şu an aktif olan arayüz özellikleri: ";
        let additionalContext = "";

        if (states) {
            if (states.search) featureContext += "[Web Araması Aktif] ";
            if (states.reasoning) featureContext += "[Derin Analiz/Akıl Yürütme Aktif] ";
            if (states.ocr) featureContext += "[Görselden Metin Okuma Aktif] ";
            if (states.bgRemover) featureContext += "[Arka Plan Silme Aktif] ";
            
            if (states.lastQuakes || states.kandilli || states.afad || (message && message.toLowerCase().includes("deprem"))) {
                featureContext += "[Deprem Veri Takibi Aktif] ";
                const quakes = await getEarthquakeData();
                additionalContext = `\n\nSON DEPREM VERİLERİ (Kandilli/AFAD):\n${quakes}\n\nLütfen bu verileri kullanarak kullanıcıya bilgi ver.`;
            }
        }

        const chat = model.startChat({
            history: history ? history.map(h => ({
                role: h.sender === 'user' ? 'user' : 'model',
                parts: [{ text: h.text }],
            })) : [],
        });

        const prompt = `${featureContext}${additionalContext}\n\nKullanıcı: ${message}`;
        const result = await chat.sendMessage(prompt);
        const responseText = result.response.text();
        
        const aiResponse = {
            text: responseText,
            sender: 'bot',
            timestamp: new Date().toISOString()
        };

        res.json(aiResponse);

    } catch (error) {
        console.error('Gemini API Hatası:', error);
        if (error.status === 429) {
            return res.status(429).json({ 
                error: "Şu an çok yoğunum! Solenz Core kapasitesi geçici olarak doldu. Lütfen birkaç dakika sonra tekrar yaz." 
            });
        }
        res.status(500).json({ error: 'AI yanıtı oluşturulurken bir hata oluştu.' });
    }
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Solenzi Backend sunucusu http://localhost:${PORT} adresinde çalışıyor.`);
    });
}

module.exports = app;
