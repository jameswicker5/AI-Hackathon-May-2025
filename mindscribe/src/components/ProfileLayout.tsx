import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserRound, FileImage, FileVideo } from "lucide-react";
import { Link } from "react-router-dom";

interface MediaItem {
  id: string;
  title: string;
  type: 'image' | 'video' | 'document';
  thumbnail: string;
  uploadedAt: Date;
}

const formatDate = (date?: Date) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
};

const ProfileLayout: React.FC = () => {
  const [isFollowing, setIsFollowing] = useState(false);
  const [userMedia, setUserMedia] = useState<MediaItem[]>([
    {
      id: '1',
      title: 'Beach Vacation Photos',
      type: 'image',
      thumbnail: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158',
      uploadedAt: new Date('2023-12-15')
    },
    {
      id: '2',
      title: 'Conference Presentation',
      type: 'video',
      thumbnail: 'https://images.unsplash.com/photo-1581092795360-fd1ca04f0952',
      uploadedAt: new Date('2024-01-23')
    },
    {
      id: '3',
      title: 'City Skyline Photos',
      type: 'image',
      thumbnail: 'https://images.unsplash.com/photo-1721322800607-8c38375eef04',
      uploadedAt: new Date('2024-03-05')
    }
  ]);

  const toggleFollow = () => {
    setIsFollowing(prev => !prev);
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Navigation bar with back button */}
      <div className="bg-white shadow-sm py-4">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <Link to="/" className="text-gray-700 hover:text-primary flex items-center gap-1">
            <span>← Back to Documents</span>
          </Link>
        </div>
      </div>

      {/* Profile header section */}
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="flex flex-col md:flex-row md:items-center gap-8">
            {/* Avatar */}
            <Avatar className="h-24 w-24 md:h-32 md:w-32 border-2 border-primary">
              <AvatarImage src="https://images.unsplash.com/photo-1649972904349-6e44c42644a7" alt="User Avatar" />
              <AvatarFallback>
                <UserRound className="h-12 w-12" />
              </AvatarFallback>
            </Avatar>
            
            {/* User info */}
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold">Alex Johnson</h1>
              <p className="text-gray-600 mt-1">Document Analysis Specialist</p>
              <p className="mt-4 text-gray-700 max-w-2xl">
                I specialize in analyzing complex documents and extracting valuable insights. With expertise in knowledge graph technologies and document processing, I help organizations make sense of their unstructured data.
              </p>
              
              {/* Stats */}
              <div className="flex gap-6 mt-6">
                <div>
                  <p className="font-bold text-lg">238</p>
                  <p className="text-sm text-gray-600">Documents</p>
                </div>
                <div>
                  <p className="font-bold text-lg">15.4K</p>
                  <p className="text-sm text-gray-600">Followers</p>
                </div>
                <div>
                  <p className="font-bold text-lg">342</p>
                  <p className="text-sm text-gray-600">Following</p>
                </div>
              </div>
            </div>
            
            {/* Follow button */}
            <div>
              <Button 
                onClick={toggleFollow}
                variant={isFollowing ? "outline" : "default"}
                className={isFollowing ? "border-gray-300" : ""}
              >
                {isFollowing ? "Following" : "Follow"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Media gallery */}
      <div className="container mx-auto px-4 py-6">
        <h2 className="text-xl font-semibold mb-6">Public Documents</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {userMedia.map((item) => (
            <Card key={item.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <div className="relative aspect-video bg-gray-100">
                <img 
                  src={item.thumbnail} 
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1">
                  {item.type === 'image' && <FileImage className="h-4 w-4" />}
                  {item.type === 'video' && <FileVideo className="h-4 w-4" />}
                </div>
              </div>
              <CardContent className="p-4">
                <h3 className="font-medium line-clamp-1">{item.title}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {formatDate(item.uploadedAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProfileLayout;
