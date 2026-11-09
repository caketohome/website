async function probe() {
  for (let i = 0; i < 15; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9000/api/v1/health');
      if (res.ok) {
        console.log('NestJS port 9000 is UP and healthy!');
        const text = await res.text();
        console.log('Health response:', text);
        return;
      }
    } catch (e) {
      // wait 1 second
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  console.log('NestJS port 9000 did not respond within 15 seconds.');
}

probe();
