// Helper function to generate full URL for uploaded files
export const getFileUrl = (filePath, req) => {
  if (!filePath) return null;
  
  // Get the base URL from the request
  const protocol = req.protocol;
  const host = req.get('host');
  const baseUrl = `${protocol}://${host}`;
  
  // Convert Windows path to URL path
  const urlPath = filePath.replace(/\\/g, '/');
  
  return `${baseUrl}/${urlPath}`;
};

// Helper function to add URLs to post data
export const addUrlsToPost = (post, req) => {
  const postObj = post.toObject ? post.toObject() : post;
  
  if (postObj.image) {
    postObj.imageUrl = getFileUrl(postObj.image, req);
  }
  
  if (postObj.video) {
    postObj.videoUrl = getFileUrl(postObj.video, req);
  }
  
  return postObj;
};

// Helper function to add URLs to multiple posts
export const addUrlsToPosts = (posts, req) => {
  return posts.map(post => addUrlsToPost(post, req));
};

// Helper function to add URLs to story data
export const addUrlsToStory = (story, req) => {
  const storyObj = story.toObject ? story.toObject() : story;
  
  if (storyObj.image) {
    storyObj.imageUrl = getFileUrl(storyObj.image, req);
  }
  
  if (storyObj.video) {
    storyObj.videoUrl = getFileUrl(storyObj.video, req);
  }
  
  return storyObj;
};

// Helper function to add URLs to multiple stories
export const addUrlsToStories = (stories, req) => {
  return stories.map(story => addUrlsToStory(story, req));
};






