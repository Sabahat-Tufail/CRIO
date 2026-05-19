import { CONFIG } from './config.js';

async function testAPIs() {
  console.log('--- Testing Weather API ---');
  try {
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=Peshawar&appid=${CONFIG.OPENWEATHER_API_KEY}&units=metric`;
    const wRes = await fetch(weatherUrl);
    console.log(`Weather API Status: ${wRes.status} ${wRes.statusText}`);
    if (wRes.ok) {
      const data = await wRes.json();
      console.log('Weather Data:', JSON.stringify(data, null, 2));
    } else {
      console.log('Weather Error Body:', await wRes.text());
    }
  } catch (err) {
    console.error('Weather error:', err.message);
  }

  console.log('\n--- Testing News API ---');
  try {
    const newsUrl = `https://newsapi.org/v2/everything?q=Peshawar%20AND%20(flood%20OR%20heatwave%20OR%20accident%20OR%20emergency%20OR%20disaster%20OR%20weather%20OR%20crisis)&sortBy=publishedAt&pageSize=3&apiKey=${CONFIG.NEWS_API_KEY}`;
    const nRes = await fetch(newsUrl, {
      headers: {
        'User-Agent': 'CIRO-Platform/1.0'
      }
    });
    console.log(`News API Status: ${nRes.status} ${nRes.statusText}`);
    if (nRes.ok) {
      const data = await nRes.json();
      console.log(`News Articles Found: ${data.articles?.length || 0}`);
      if (data.articles && data.articles.length > 0) {
        data.articles.forEach((a, i) => {
          console.log(`\nArticle #${i+1}:`);
          console.log(`Title: ${a.title}`);
          console.log(`Source: ${a.source?.name}`);
          console.log(`URL: ${a.url}`);
        });
      }
    } else {
      console.log('News Error Body:', await nRes.text());
    }
  } catch (err) {
    console.error('News error:', err.message);
  }
}

testAPIs();
