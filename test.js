const axios = require('axios');

async function testRanking() {
    try {
        const response = await axios.post('http://localhost:5000/api/check-rankings', {
            domain: 'example.com',
            keywords: ['test keyword']
        });
        console.log('Response:', response.data);
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
    }
}

testRanking(); 