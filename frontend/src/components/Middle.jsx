import React, { useState, useRef, useEffect } from 'react';
import BookmarkBorderOutlinedIcon from '@mui/icons-material/BookmarkBorderOutlined';
import profilepic from '../assets/profile-pic.png';
import AttachmentOutlinedIcon from '@mui/icons-material/AttachmentOutlined';

const Middle = () => {
    const [inputText, setInputText] = useState('');
    const [tagInput, setTagInput] = useState('');
    const [tags, setTags] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null); // State for the file
    const fileInputRef = useRef(null); // Reference for hidden file input
    const [currentPostIndex, setCurrentPostIndex] = useState(0); // Track the current post index
    const [currentPost, setCurrentPost] = useState(null); // Store the current post data

    // Function to fetch a post by its position
    // const fetchPost = async (index) => {
    //     try {
    //         const response = await fetch(`http://localhost:5000/messages/${index}`);
    //         if (response.ok) {
    //             const data = await response.json();
    //             setCurrentPost(data); // Update the current post
    //         } else {
    //             console.log(await response.json()); // Log error message
    //         }
    //     } catch (error) {
    //         console.error('Error fetching post:', error);
    //     }
    // };

    const fetchPost = async (index) => {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`http://localhost:5000/messages/${index}`, {
                headers: {
                    'authorization': `Bearer ${token}`,
                },
            });
    
            if (response.ok) {
                const data = await response.json();
                setCurrentPost(data);
    
                // Mark the post as seen
                await fetch(`http://localhost:5000/messages/${data._id}/seen`, {
                    method: 'PUT',
                    headers: {
                        'authorization': `Bearer ${token}`,
                    },
                });
            } else {
                console.error(await response.json());
            }
        } catch (error) {
            console.error('Error fetching post:', error);
        }
    };
    

    // Initial fetch for the latest post (index 0)
    useEffect(() => {
        fetchPost(0);
    }, []);

    // Handle "Next" button click
    const handleNext = () => {
        const token = localStorage.getItem('accessToken');
        setCurrentPostIndex((prevIndex) => {
            const newIndex = prevIndex + 1;
            fetchPost(newIndex); // Fetch the next post
            console.log(currentPost.image);
            return newIndex;
        });
    };

    const handleInput = (event) => {
        const maxLength = 500;
        const value = event.target.value;
        if (value.length <= maxLength) {
            setInputText(value);
            event.target.style.height = 'auto';
            event.target.style.height = `${event.target.scrollHeight}px`;
        }
    };

    const handleTagInput = (event) => {
        setTagInput(event.target.value);
    };

    const handleTagKeyDown = (event) => {
        if (event.key === ',' || event.key === 'Enter') {
            event.preventDefault();
            const tag = tagInput.trim();
            if (tag && !tags.includes(tag)) {
                setTags([...tags, tag]);
                setTagInput('');
            }
        }
    };

    const handleTagRemove = (index) => {
        setTags(tags.filter((_, i) => i !== index));
    };

    const remainingChars = 500 - inputText.length;

    const handleFileInputClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = (event) => {
        const files = event.target.files;
        if (files && files[0]) {
            setSelectedFile(files[0]); // Save the selected file
        }
    };

    const handleFileRemove = () => {
        setSelectedFile(null); // Reset file state
    };

    const handlePost = async (event) => {
        event.preventDefault();
        const token = localStorage.getItem('accessToken');

        // Create FormData
        const formData = new FormData();
        formData.append('content', inputText);
        formData.append('tags', JSON.stringify(tags)); // Serialize tags as a string
        if (selectedFile) {
            formData.append('image', selectedFile); // Append the file
        }

        try {
            const response = await fetch('http://localhost:5000/messages', {
                method: 'POST',
                headers: {
                    'authorization': `Bearer ${token}`,
                },
                body: formData, // Use FormData
            });

            const data = await response.json();
            if (response.ok) {
                console.log(data);
                setInputText('');
                setTags([]);
                setSelectedFile(null); // Reset file state
            } else {
                console.log(data.message);
            }
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="middle">
            <form className="create-post" onSubmit={handlePost}>
                <div className="flex items-start gap-4 w-full">
                    <div className="profile-photo">
                        <img src={profilepic} alt="Profile" />
                    </div>
                    <div className="w-full">
                        <textarea
                            placeholder="Write here.."
                            rows="1"
                            style={{ resize: 'none', overflow: 'hidden' }}
                            value={inputText}
                            onInput={handleInput}
                            className="w-full mt-4 border-b-2 border-gray-300 px-3 py-2"
                        />
                        <div className="flex flex-col">
                            <div className="flex items-center">
                                <span>
                                    <AttachmentOutlinedIcon
                                        className="mr-2 cursor-pointer"
                                        onClick={handleFileInputClick}
                                    />
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        style={{ display: 'none' }}
                                        onChange={handleFileChange}
                                    />
                                </span>
                                <span>
                                    <BookmarkBorderOutlinedIcon />
                                </span>
                                <input
                                    type="text"
                                    placeholder="Type tags separated by comma"
                                    className="w-full border-b-2 border-gray-300 px-3 py-2"
                                    value={tagInput}
                                    onChange={handleTagInput}
                                    onKeyDown={handleTagKeyDown}
                                />
                                <div className="flex flex-col items-center justify-center mt-4">
                                    <input type="submit" value="Post" className="btn btn-primary" />
                                    <small
                                        className={`block mt-1 text-sm ${remainingChars <= 50 ? 'text-red-500' : 'text-gray-500'}`}
                                    >
                                        {remainingChars} chars left
                                    </small>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mb-4">
                                {tags.map((tag, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-sm"
                                    >
                                        <span>{tag}</span>
                                        <button
                                            type="button"
                                            className="ml-2 text-blue-500 hover:text-blue-700"
                                            onClick={() => handleTagRemove(index)}
                                        >
                                            &times;
                                        </button>
                                    </div>
                                ))}
                            </div>
                            {selectedFile && (
                                <div className="flex items-center gap-2 mt-2">
                                    <img
                                        src={URL.createObjectURL(selectedFile)}
                                        alt="Preview"
                                        className="w-12 h-12 object-cover rounded"
                                    />
                                    <button
                                        type="button"
                                        className="text-red-500 hover:text-red-700"
                                        onClick={handleFileRemove}
                                    >
                                        &times;
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </form>
            <div className="feeds">
                {currentPost ? (
                    <div className="feed">
                        <div className="head">
                            <div className="user">
                                <div className="profile-photo">
                                    <img src={profilepic} alt="Feed Profile" />
                                </div>
                                <div className="info">
                                    <h3>{currentPost.author || 'Anonymous'}</h3>
                                    <small>{currentPost.location || 'Unknown'}, {new Date(currentPost.createdAt).toLocaleString()}</small>
                                </div>
                            </div>
                        </div>
                        <div className="text-content">
                            <p>{currentPost.content || 'No content available.'}</p>
                        </div>
                        {currentPost.imageUrl && (
                            <div className="photo">
                                <img src={`http://localhost:5000${currentPost.imageUrl}`} alt="Feed Content" />
                            </div>
                        )}
                        <div className="action-buttons flex flex-wrap items-center gap-4">
                            <div className="interaction-buttons flex flex-wrap items-center gap-2">
                                <span>
                                    <BookmarkBorderOutlinedIcon />
                                </span>
                                <div className="tag-bubbles flex flex-wrap gap-2">
                                    {currentPost.tags &&
                                        currentPost.tags.map((tag, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-sm"
                                            >
                                                <span>#{tag}</span>
                                            </div>
                                        ))}
                                </div>
                            </div>
                            <div className="reply-next-buttons flex gap-2 ml-auto">
                                <button className="btn btn-primary">Reply</button>
                                <button className="btn btn-primary" onClick={handleNext}>
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <p>Loading post...</p>
                )}
            </div>
        </div>
    );
};

export default Middle;
