import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';

const App = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (event) => {
    setSearchTerm(event.target.value);
    setError(''); // Clear error when typing
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && searchTerm.trim() !== '') {
      handleSearch();
    }
  };

  const handleSearch = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:5000/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: searchTerm }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setSearchResults([]); // Ensure previous results are cleared
      setError('An error occurred while fetching results.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setSearchTerm('');
    setSearchResults([]);
    setError('');
  };

  return (
    <Container>
      <InnerContainer>
        <Heading>QueryMind</Heading>
        <SearchBarContainer>
          <SearchInput
            type="text"
            placeholder="Enter your query here..."
            value={searchTerm}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
          />
          <SearchButton onClick={handleSearch}>Search</SearchButton>
          <ClearButton onClick={handleClear}>Clear</ClearButton>
        </SearchBarContainer>
        {error && <ErrorText>{error}</ErrorText>}
        {isLoading && <LoadingText>Loading...</LoadingText>}
        {searchResults.length > 0 && (
          <ResultsContainer>
            {searchResults.map((result, index) => (
              <ResultBlock key={index}>
                {typeof result === 'string' ? (
                  <p>{result}</p>
                ) : (
                  <>
                    <h3>{result.title || result.title}</h3>
                    <p>{result.abstract || JSON.stringify(result.abstract)}</p>
                    <p>{result.authors || JSON.stringify(result.authors)}</p>
                    <p>{result.categories|| JSON.stringify(result.categories)}</p>
                    {/* <p>{result.summary || JSON.stringify(result.summary)}</p> */}
                  </>
                )}
              </ResultBlock>
            ))}
          </ResultsContainer>
        )}
      </InnerContainer>
    </Container>
  );
};

export default App;

// Styled Components
const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const Container = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #5C7C89; /* Larger background color */
  padding: 10px;
`;

const InnerContainer = styled.div`
  background-color: #242424; /* Darker content background */
  padding: 20px;
  border-radius: 15px;
  box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.2);
  width: 80%;
  max-height: 90vh;
  overflow: hidden;
`;

const Heading = styled.h1`
  font-size: 3rem;
  color: #FFFFFF;
  margin-bottom: 20px;
  text-align: center;
  font-family: 'Arial', sans-serif;
`;

const SearchBarContainer = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
`;

const SearchInput = styled.input`
  flex: 1;
  padding: 10px 20px;
  font-size: 1.2rem;
  border-radius: 25px;
  border: 1px solid #1F4959;
  background-color: #FFFFFF;
  color: #242424;
  box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.1);

  &:focus {
    border-color: #011425;
    box-shadow: 0px 4px 6px rgba(31, 73, 89, 0.3);
    outline: none;
  }
`;

const SearchButton = styled.button`
  padding: 10px 20px;
  font-size: 1.2rem;
  border-radius: 25px;
  background-color: #1F4959;
  color: #FFFFFF;
  border: none;
  cursor: pointer;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: #011425;
  }
`;

const ClearButton = styled(SearchButton)`
  background-color: #5C7C89;

  &:hover {
    background-color: #1F4959;
  }
`;

const ResultsContainer = styled.div`
  max-height: 50vh;
  overflow-y: auto;
  margin-top: 20px;
  padding: 10px;
  background-color: rgba(255, 255, 255, 0.05); /* Slightly transparent background */
  border-radius: 10px;
  box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.1);
`;

const ResultBlock = styled.div`
  background: #242424;
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 10px;
  color: #FFFFFF;
  box-shadow: 0px 4px 6px rgba(0, 0, 0, 0.1);
  animation: ${fadeIn} 0.5s ease-in-out;

  h3 {
    font-size: 1.5rem;
    margin-bottom: 10px;
  }

  p {
    font-size: 1rem;
    color: #5C7C89;
  }
`;

const ErrorText = styled.p`
  color: #FF5C5C;
  font-size: 1rem;
`;

const LoadingText = styled.p`
  color: #FFFFFF;
  font-size: 1rem;
`;
