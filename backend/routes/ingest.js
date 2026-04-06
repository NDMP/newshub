// Add this endpoint
router.post('/ingest-international', async (req, res) => {
  try {
    const { fetchInternationalFeeds } = require('../scripts/add-international-feeds');
    
    // Run in background
    res.json({ message: 'International feed sync started in background' });
    
    // Don't await - let it run in background
    fetchInternationalFeeds().catch(console.error);
    
  } catch (err) {
    console.error('❌ Error starting international sync:', err);
    res.status(500).json({ error: err.message });
  }
});